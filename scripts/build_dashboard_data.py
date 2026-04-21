from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = ROOT_DIR.parent / "data_bexfil"
SOURCE_DIR = Path(
    os.environ.get("BEXFIL_SOURCE_DIR", str(DEFAULT_SOURCE_DIR))
).expanduser()
MANUAL_DIR = ROOT_DIR / "manual-data"
OUTPUT_FILE = ROOT_DIR / "public" / "data" / "dashboard-data.json"
TELEGRAM_DOWNLOADS_DIR = Path.home() / "Downloads" / "Telegram Desktop"

DDS_FILE = SOURCE_DIR / "Данные для ДДС.xlsx"
FINANCE_ACTUALS_FILE = MANUAL_DIR / "finance_actuals.csv"
LOST_CONTRACTS_FILE = MANUAL_DIR / "lost_contracts.csv"
OPPORTUNITIES_FILE = MANUAL_DIR / "opportunities.csv"
PRODUCTION_STATUS_FILE = MANUAL_DIR / "production_status.csv"

MONTHS_RU = {
    "январь": 1,
    "февраль": 2,
    "март": 3,
    "апрель": 4,
    "май": 5,
    "июнь": 6,
    "июль": 7,
    "август": 8,
    "сентябрь": 9,
    "октябрь": 10,
    "ноябрь": 11,
    "декабрь": 12,
}


@dataclass(frozen=True)
class SourceFlags:
    monthly_plan_loaded: bool
    weekly_plan_loaded: bool
    finance_actuals_loaded: bool
    lost_contracts_loaded: bool
    opportunities_loaded: bool
    production_loaded: bool
    april_plan_fact_loaded: bool
    erp_cashflow_loaded: bool
    erp_pnl_loaded: bool


def _normalize_label(value: object) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except TypeError:
        pass
    return str(value).strip()


def _resolve_optional_file(env_var: str, filenames: list[str]) -> Path | None:
    explicit = os.environ.get(env_var)
    if explicit:
        path = Path(explicit).expanduser()
        if path.exists():
            return path

    for directory in (SOURCE_DIR, TELEGRAM_DOWNLOADS_DIR):
        for filename in filenames:
            candidate = directory / filename
            if candidate.exists():
                return candidate
    return None


def _coerce_number(value: object) -> float:
    if value in (None, "", " "):
        return 0.0
    if isinstance(value, (int, float)):
        if pd.isna(value):
            return 0.0
        return float(value)
    text = str(value).replace(" ", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _parse_excel_date(value: object) -> pd.Timestamp:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return pd.NaT
    if isinstance(value, pd.Timestamp):
        return value.normalize()
    if isinstance(value, datetime):
        return pd.Timestamp(value).normalize()

    text = str(value).strip()
    if not text:
        return pd.NaT

    compact_match = re.fullmatch(r"(\d{2})\.(\d{2})(\d{4})", text)
    if compact_match:
        day, month, year = compact_match.groups()
        return pd.Timestamp(year=int(year), month=int(month), day=int(day))

    parsed = pd.to_datetime(text, dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        return pd.NaT
    return parsed.normalize()


HISTORICAL_DDS_FILE = _resolve_optional_file(
    "BEXFIL_HISTORICAL_DDS_FILE",
    ["ДДС Апрель 2026 (-).xlsx"],
)
ERP_CASHFLOW_FILE = _resolve_optional_file(
    "BEXFIL_ERP_CASHFLOW_FILE",
    ["ДДС ЕРП (2025для отправки).xlsx"],
)
ERP_PNL_FILE = _resolve_optional_file(
    "BEXFIL_ERP_PNL_FILE",
    ["ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx"],
)


def _month_from_header(header: str) -> pd.Timestamp:
    cleaned = re.sub(r"\s+", " ", header.lower()).strip()
    for name, month in MONTHS_RU.items():
        if name in cleaned:
            year_match = re.search(r"(20\d{2})", cleaned)
            year = int(year_match.group(1)) if year_match else datetime.now().year
            return pd.Timestamp(year=year, month=month, day=1)
    raise ValueError(f"Cannot detect month from header: {header}")


def _safe_read_csv(path: Path, columns: list[str]) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=columns)
    frame = pd.read_csv(path)
    for column in columns:
        if column not in frame.columns:
            frame[column] = pd.NA
    return frame[columns]


def _metric_group_from_dds_row(line_name: str) -> str | None:
    lowered = line_name.lower()
    if lowered in {"доход", "выручка"}:
        return "income"
    if lowered in {"расход", "остаток на р/счете"}:
        return "expense" if lowered == "расход" else None
    return "expense"


def load_finance_monthly_plan() -> pd.DataFrame:
    sheet = pd.read_excel(DDS_FILE, sheet_name="Лист1", header=0)
    month_columns = [column for column in sheet.columns[1:] if "итого" not in str(column).lower()]
    records: list[dict[str, object]] = []

    for _, row in sheet.iterrows():
        line_name = _normalize_label(row["Названия строк"])
        metric_group = _metric_group_from_dds_row(line_name)
        if metric_group is None:
            continue
        for column in month_columns:
            records.append(
                {
                    "period_month": _month_from_header(str(column)),
                    "metric_group": metric_group,
                    "line_name": line_name,
                    "plan_amount": _coerce_number(row[column]),
                    "is_total": line_name in {"Доход", "Расход"},
                }
            )

    return pd.DataFrame(records).sort_values(["period_month", "metric_group", "line_name"]).reset_index(drop=True)


def load_finance_weekly_plan() -> pd.DataFrame:
    sheet = pd.read_excel(DDS_FILE, sheet_name="Лист2", header=None)
    raw_dates = list(sheet.iloc[1, 1:-1])
    records: list[dict[str, object]] = []

    for row_index in range(2, len(sheet)):
        line_name = _normalize_label(sheet.iloc[row_index, 0])
        metric_group = _metric_group_from_dds_row(line_name)
        if metric_group is None:
            continue

        for offset, raw_date in enumerate(raw_dates, start=1):
            week_date = _parse_excel_date(raw_date)
            if pd.isna(week_date):
                continue
            records.append(
                {
                    "week_date": week_date,
                    "metric_group": metric_group,
                    "line_name": line_name,
                    "plan_amount": _coerce_number(sheet.iloc[row_index, offset]),
                    "is_total": line_name in {"Доход", "Расход"},
                }
            )

    return pd.DataFrame(records).sort_values(["week_date", "metric_group", "line_name"]).reset_index(drop=True)


def load_finance_actuals() -> pd.DataFrame:
    columns = [
        "period_type",
        "period_start",
        "metric_group",
        "line_name",
        "fact_amount",
        "source_name",
        "comment",
    ]
    frame = _safe_read_csv(FINANCE_ACTUALS_FILE, columns)
    if frame.empty:
        return frame
    frame["period_start"] = pd.to_datetime(frame["period_start"], errors="coerce")
    frame["fact_amount"] = frame["fact_amount"].map(_coerce_number)
    frame = frame.dropna(subset=["period_start"]).reset_index(drop=True)
    return frame


def load_lost_contracts() -> pd.DataFrame:
    columns = [
        "lost_contract_id",
        "lost_date",
        "customer_name",
        "customer_inn",
        "contract_name",
        "amount_estimate",
        "source_type",
        "source_ref",
        "lost_reason",
        "lost_reason_group",
        "owner",
        "notes",
    ]
    frame = _safe_read_csv(LOST_CONTRACTS_FILE, columns)
    if frame.empty:
        return frame
    frame["lost_date"] = pd.to_datetime(frame["lost_date"], errors="coerce")
    frame["amount_estimate"] = frame["amount_estimate"].map(_coerce_number)
    frame["period_month"] = frame["lost_date"].dt.to_period("M").dt.to_timestamp()
    return frame


def load_opportunities() -> pd.DataFrame:
    columns = [
        "opportunity_id",
        "event_date",
        "customer_name",
        "customer_inn",
        "title",
        "expected_revenue",
        "probability",
        "status",
        "source_type",
        "source_ref",
        "next_step",
        "owner",
        "notes",
    ]
    frame = _safe_read_csv(OPPORTUNITIES_FILE, columns)
    if frame.empty:
        return frame
    frame["event_date"] = pd.to_datetime(frame["event_date"], errors="coerce")
    frame["expected_revenue"] = frame["expected_revenue"].map(_coerce_number)
    frame["probability"] = frame["probability"].map(_coerce_number)
    return frame


def load_production_status() -> pd.DataFrame:
    columns = [
        "snapshot_date",
        "contract_name",
        "customer_name",
        "planned_ship_date",
        "readiness_pct",
        "cogs_plan",
        "cogs_fact",
        "production_status",
        "revenue_recognition_ready",
        "notes",
    ]
    frame = _safe_read_csv(PRODUCTION_STATUS_FILE, columns)
    if frame.empty:
        return frame
    frame["snapshot_date"] = pd.to_datetime(frame["snapshot_date"], errors="coerce")
    frame["planned_ship_date"] = pd.to_datetime(frame["planned_ship_date"], errors="coerce")
    frame["readiness_pct"] = frame["readiness_pct"].map(_coerce_number)
    frame["cogs_plan"] = frame["cogs_plan"].map(_coerce_number)
    frame["cogs_fact"] = frame["cogs_fact"].map(_coerce_number)
    return frame


def _find_row_index(labels: pd.Series, pattern: str) -> int | None:
    matches = labels[labels.str.contains(pattern, regex=True, case=False, na=False)]
    if matches.empty:
        return None
    return int(matches.index[0])


def _lookup_row_value(
    frame: pd.DataFrame,
    labels: pd.Series,
    pattern: str,
    column: object,
) -> float:
    row_index = _find_row_index(labels, pattern)
    if row_index is None:
        return 0.0
    return _coerce_number(frame.at[row_index, column])


def _parse_week_start(header: str, year: int, month: int) -> pd.Timestamp:
    match = re.search(r"\((\d{2})-\d{2}\)", header)
    if not match:
        return pd.NaT
    return pd.Timestamp(year=year, month=month, day=int(match.group(1)))


def load_historical_april_weekly_plan_fact() -> pd.DataFrame:
    columns = [
        "week_date",
        "metric_group",
        "line_name",
        "plan_amount",
        "fact_amount",
        "has_actual",
        "delta_amount",
    ]
    if HISTORICAL_DDS_FILE is None:
        return pd.DataFrame(columns=columns)

    sheet = pd.read_excel(HISTORICAL_DDS_FILE, sheet_name=0, header=None)
    if sheet.empty:
        return pd.DataFrame(columns=columns)

    top_headers = sheet.iloc[2].tolist()
    sub_headers = sheet.iloc[3].tolist()
    labels = sheet.iloc[:, 0].map(_normalize_label)
    income_row = _find_row_index(labels, r"^Поступления$")
    expense_row = _find_row_index(labels, r"^Списания \(операционная деятельность\)$")
    if income_row is None or expense_row is None:
        return pd.DataFrame(columns=columns)

    records: dict[tuple[pd.Timestamp, str], dict[str, object]] = {}
    april_section_active = False

    for column_index in range(1, sheet.shape[1]):
        header = _normalize_label(top_headers[column_index])
        marker = _normalize_label(sub_headers[column_index]).upper()
        previous_header = _normalize_label(top_headers[column_index - 1]) if column_index > 1 else ""
        effective_header = header
        if not effective_header and "неделя" in previous_header.lower() and marker == "ФАКТ":
            effective_header = previous_header
        lowered_header = effective_header.lower()

        if "апрель 2026 итог" in lowered_header:
            april_section_active = True
            continue
        if "май 2026 итог" in lowered_header:
            break
        if not april_section_active or "неделя" not in lowered_header or marker not in {"ПЛАН", "ФАКТ"}:
            continue

        week_date = _parse_week_start(effective_header, year=2026, month=4)
        if pd.isna(week_date):
            continue

        for metric_group, row_index, line_name in (
            ("income", income_row, "Поступления"),
            ("expense", expense_row, "Списания"),
        ):
            amount = _coerce_number(sheet.iat[row_index, column_index])
            if metric_group == "expense":
                amount = abs(amount)

            key = (week_date, metric_group)
            row = records.setdefault(
                key,
                {
                    "week_date": week_date,
                    "metric_group": metric_group,
                    "line_name": line_name,
                    "plan_amount": 0.0,
                    "fact_amount": 0.0,
                    "has_actual": False,
                    "delta_amount": 0.0,
                },
            )
            if marker == "ПЛАН":
                row["plan_amount"] = amount
            else:
                row["fact_amount"] = amount
                row["has_actual"] = True

    result = pd.DataFrame(records.values())
    if result.empty:
        return pd.DataFrame(columns=columns)

    result["delta_amount"] = result["fact_amount"] - result["plan_amount"]
    return result.sort_values(["week_date", "metric_group"]).reset_index(drop=True)


def load_erp_cashflow_monthly() -> pd.DataFrame:
    columns = [
        "period_month",
        "operating_amount",
        "financial_amount",
        "investment_amount",
        "transfer_amount",
        "net_amount",
    ]
    if ERP_CASHFLOW_FILE is None:
        return pd.DataFrame(columns=columns)

    sheet = pd.read_excel(ERP_CASHFLOW_FILE, sheet_name=0, header=1)
    labels = sheet.iloc[:, 0].map(_normalize_label)
    month_columns = [
        column for column in sheet.columns[1:]
        if "итого" not in _normalize_label(column).lower()
    ]

    records: list[dict[str, object]] = []
    for column in month_columns:
        records.append(
            {
                "period_month": _month_from_header(str(column)),
                "operating_amount": _lookup_row_value(sheet, labels, r"^01 Операционная деятельность$", column),
                "financial_amount": _lookup_row_value(sheet, labels, r"^02 Финансовая деятельность$", column),
                "investment_amount": _lookup_row_value(sheet, labels, r"^03 Инвестиционная деятельность$", column),
                "transfer_amount": _lookup_row_value(sheet, labels, r"^04 Переводы$", column),
                "net_amount": _lookup_row_value(sheet, labels, r"^Общий итог$", column),
            }
        )

    return pd.DataFrame(records).sort_values("period_month").reset_index(drop=True)


def load_erp_pnl_monthly() -> pd.DataFrame:
    columns = [
        "period_month",
        "revenue_amount",
        "vp7_amount",
    ]
    if ERP_PNL_FILE is None:
        return pd.DataFrame(columns=columns)

    sheet = pd.read_excel(ERP_PNL_FILE, sheet_name=0, header=1)
    labels = sheet.iloc[:, 0].map(_normalize_label)
    month_columns = [
        column for column in sheet.columns[1:]
        if "итого" not in _normalize_label(column).lower()
    ]

    records: list[dict[str, object]] = []
    for column in month_columns:
        records.append(
            {
                "period_month": _month_from_header(str(column)),
                "revenue_amount": _lookup_row_value(sheet, labels, r"^Выручка$", column),
                "vp7_amount": _lookup_row_value(sheet, labels, r"Валовая прибыль 7", column),
            }
        )

    return pd.DataFrame(records).sort_values("period_month").reset_index(drop=True)


def build_monthly_comparison(monthly_plan: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    plan_totals = monthly_plan[monthly_plan["is_total"]].copy()
    plan_totals["summary_line"] = plan_totals["line_name"]
    plan_totals = plan_totals.rename(columns={"plan_amount": "plan_amount_raw"})

    actual_monthly = pd.DataFrame(columns=["period_month", "metric_group", "fact_amount"])
    if not actuals.empty:
        rows = actuals[actuals["period_type"].str.lower() == "month"].copy()
        if not rows.empty:
            rows["period_month"] = rows["period_start"].dt.to_period("M").dt.to_timestamp()
            actual_monthly = rows.groupby(["period_month", "metric_group"], as_index=False)["fact_amount"].sum()

    merged = plan_totals.merge(actual_monthly, on=["period_month", "metric_group"], how="outer")
    merged["summary_line"] = merged["summary_line"].fillna(
        merged["metric_group"].map({"income": "Доход", "expense": "Расход"})
    )
    merged["plan_amount"] = merged["plan_amount_raw"].fillna(0.0)
    merged = merged[merged["metric_group"].isin(["income", "expense"])].copy()
    merged["has_actual"] = merged["fact_amount"].notna()
    merged["fact_amount"] = pd.to_numeric(merged["fact_amount"], errors="coerce").fillna(0.0)
    merged["delta_amount"] = merged["fact_amount"] - merged["plan_amount"]

    adverse = pd.Series(0.0, index=merged.index, dtype="float64")
    favorable = pd.Series(0.0, index=merged.index, dtype="float64")

    expense_mask = (merged["metric_group"] == "expense") & merged["has_actual"]
    income_mask = (merged["metric_group"] == "income") & merged["has_actual"]

    adverse.loc[expense_mask] = (merged.loc[expense_mask, "fact_amount"] - merged.loc[expense_mask, "plan_amount"]).clip(lower=0)
    favorable.loc[expense_mask] = (merged.loc[expense_mask, "plan_amount"] - merged.loc[expense_mask, "fact_amount"]).clip(lower=0)
    adverse.loc[income_mask] = (merged.loc[income_mask, "plan_amount"] - merged.loc[income_mask, "fact_amount"]).clip(lower=0)
    favorable.loc[income_mask] = (merged.loc[income_mask, "fact_amount"] - merged.loc[income_mask, "plan_amount"]).clip(lower=0)

    merged["adverse_amount"] = adverse
    merged["favorable_amount"] = favorable
    return merged.sort_values(["period_month", "metric_group"]).reset_index(drop=True)


def build_weekly_summary(weekly_plan: pd.DataFrame) -> pd.DataFrame:
    totals = weekly_plan[weekly_plan["is_total"]].copy()
    totals = totals[totals["metric_group"].isin(["income", "expense"])].reset_index(drop=True)

    actuals = load_finance_actuals()
    if actuals.empty:
        totals["fact_amount"] = 0.0
        totals["has_actual"] = False
        totals["delta_amount"] = 0.0
        return totals

    weekly_actuals = actuals[actuals["period_type"].str.lower() == "week"].copy()
    if weekly_actuals.empty:
        totals["fact_amount"] = 0.0
        totals["has_actual"] = False
        totals["delta_amount"] = 0.0
        return totals

    grouped = (
        weekly_actuals.groupby(["period_start", "metric_group"], as_index=False)["fact_amount"].sum()
        .rename(columns={"period_start": "week_date"})
    )
    merged = totals.merge(grouped, on=["week_date", "metric_group"], how="left")
    merged["has_actual"] = merged["fact_amount"].notna()
    merged["fact_amount"] = merged["fact_amount"].fillna(0.0)
    merged["delta_amount"] = merged["fact_amount"] - merged["plan_amount"]
    return merged


def summarize_lost_contracts(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=["period_month", "lost_count", "amount_estimate"])
    result = (
        frame.groupby("period_month", as_index=False)
        .agg(lost_count=("lost_contract_id", "count"), amount_estimate=("amount_estimate", "sum"))
        .sort_values("period_month")
    )
    return result


def summarize_opportunities(frame: pd.DataFrame) -> dict[str, object]:
    if frame.empty:
        return {"status_counts": [], "expected_revenue_total": 0.0}
    status_counts = (
        frame["status"].fillna("Не указан").astype(str).value_counts().reset_index().rename(
            columns={"index": "status", "status": "count"}
        )
    )
    return {
        "status_counts": status_counts.to_dict(orient="records"),
        "expected_revenue_total": float(frame["expected_revenue"].sum()),
    }


def summarize_production(frame: pd.DataFrame) -> dict[str, object]:
    if frame.empty:
        return {"ready_count": 0, "not_ready_count": 0, "avg_readiness_pct": 0.0}
    readiness = frame["readiness_pct"].fillna(0.0)
    ready_count = int(frame["revenue_recognition_ready"].fillna("").astype(str).str.lower().isin(["true", "1", "yes", "да"]).sum())
    not_ready_count = int(len(frame) - ready_count)
    return {
        "ready_count": ready_count,
        "not_ready_count": not_ready_count,
        "avg_readiness_pct": float(readiness.mean()),
    }


def frame_to_records(frame: pd.DataFrame, date_columns: list[str]) -> list[dict[str, object]]:
    if frame.empty:
        return []
    serializable = frame.copy()
    for column in date_columns:
        if column in serializable.columns:
            serializable[column] = pd.to_datetime(serializable[column], errors="coerce").dt.strftime("%Y-%m-%d")
            serializable[column] = serializable[column].replace("NaT", None)
    return json.loads(serializable.to_json(orient="records", force_ascii=False))


def build_payload() -> dict[str, object]:
    monthly_plan = load_finance_monthly_plan()
    weekly_plan = load_finance_weekly_plan()
    finance_actuals = load_finance_actuals()
    monthly_comparison = build_monthly_comparison(monthly_plan, finance_actuals)
    weekly_summary = build_weekly_summary(weekly_plan)
    historical_weekly_plan_fact = load_historical_april_weekly_plan_fact()
    erp_cashflow_monthly = load_erp_cashflow_monthly()
    erp_pnl_monthly = load_erp_pnl_monthly()
    lost_contracts = load_lost_contracts()
    opportunities = load_opportunities()
    production_status = load_production_status()

    flags = SourceFlags(
        monthly_plan_loaded=not monthly_plan.empty,
        weekly_plan_loaded=not weekly_plan.empty,
        finance_actuals_loaded=not finance_actuals.empty,
        lost_contracts_loaded=not lost_contracts.empty,
        opportunities_loaded=not opportunities.empty,
        production_loaded=not production_status.empty,
        april_plan_fact_loaded=not historical_weekly_plan_fact.empty,
        erp_cashflow_loaded=not erp_cashflow_monthly.empty,
        erp_pnl_loaded=not erp_pnl_monthly.empty,
    )

    months = sorted(monthly_comparison["period_month"].dropna().unique().tolist()) if not monthly_comparison.empty else []
    weeks = sorted(weekly_summary["week_date"].dropna().unique().tolist()) if not weekly_summary.empty else []

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_dir": str(SOURCE_DIR),
        "source_flags": asdict(flags),
        "availability": {
            "monthly_range": [
                pd.Timestamp(months[0]).strftime("%Y-%m-%d"),
                pd.Timestamp(months[-1]).strftime("%Y-%m-%d"),
            ] if months else [],
            "weekly_range": [
                pd.Timestamp(weeks[0]).strftime("%Y-%m-%d"),
                pd.Timestamp(weeks[-1]).strftime("%Y-%m-%d"),
            ] if weeks else [],
            "facts_loaded": not finance_actuals.empty,
            "losses_loaded": not lost_contracts.empty,
            "opportunities_loaded": not opportunities.empty,
            "historical_april_loaded": not historical_weekly_plan_fact.empty,
            "historical_erp_loaded": not erp_cashflow_monthly.empty or not erp_pnl_monthly.empty,
        },
        "monthlyComparison": frame_to_records(
            monthly_comparison,
            ["period_month"],
        ),
        "weeklySummary": frame_to_records(
            weekly_summary,
            ["week_date"],
        ),
        "weeklyPlanLines": frame_to_records(
            weekly_plan[weekly_plan["metric_group"].isin(["income", "expense"])],
            ["week_date"],
        ),
        "historicalWeeklyPlanFact": frame_to_records(
            historical_weekly_plan_fact,
            ["week_date"],
        ),
        "erpCashflowMonthly": frame_to_records(
            erp_cashflow_monthly,
            ["period_month"],
        ),
        "erpPnlMonthly": frame_to_records(
            erp_pnl_monthly,
            ["period_month"],
        ),
        "financeActuals": frame_to_records(
            finance_actuals,
            ["period_start"],
        ),
        "lostContracts": frame_to_records(
            lost_contracts,
            ["lost_date", "period_month"],
        ),
        "lostContractsMonthly": frame_to_records(
            summarize_lost_contracts(lost_contracts),
            ["period_month"],
        ),
        "opportunities": frame_to_records(
            opportunities,
            ["event_date"],
        ),
        "opportunitiesSummary": summarize_opportunities(opportunities),
        "productionStatus": frame_to_records(
            production_status,
            ["snapshot_date", "planned_ship_date"],
        ),
        "productionSummary": summarize_production(production_status),
    }
    return payload


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload()
    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
