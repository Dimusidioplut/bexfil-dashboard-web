# Data Architecture

## Принцип

Исходные документы в `/Users/vasa/Documents/projects work/big company/bexfil/data_bexfil` считаются immutable raw-source. Все преобразования выполняются поверх них в слое `dashboard`.

## Слои

### 1. Raw

Исходники:
- `Данные для ДДС.xlsx`
- `ДДС Апрель 2026 (-).xlsx`
- `ДДС ЕРП (2025для отправки).xlsx`
- `ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx`
- `Бэкс - 06.02.2026 база на согласование.xlsx`
- `Контур.Закупки_20.04.2026*.xlsx`

### 2. Manual

Ручные таблицы, которых не хватает в raw:
- `finance_actuals.csv`
- `opportunities.csv`
- `lost_contracts.csv`
- `production_status.csv`

### 3. Normalized

Нормализованные датафреймы и будущие БД-таблицы, которые строятся в коде:
- `finance_plan_monthly`
- `finance_plan_weekly`
- `finance_fact_weekly_partial`
- `finance_fact_full`
- `tenders`
- `tender_customers_aggregated`
- `companies`
- `opportunities`
- `lost_contracts`
- `production_status`

### 4. Presentation

Текущий движок:
- `React + Vite`

Будущий вариант:
- PostgreSQL + BI-слой

## Нормализованные наборы данных

### finance_plan_monthly

Источник:
- `Данные для ДДС.xlsx`, `Лист1`

Поля:
- `period_month`
- `metric_group`
- `line_name`
- `plan_amount`
- `is_total`
- `source_file`
- `source_sheet`

Покрытие:
- `апрель-июнь 2026`

### finance_plan_weekly

Источник:
- `Данные для ДДС.xlsx`, `Лист2`

Поля:
- `week_date`
- `metric_group`
- `line_name`
- `plan_amount`
- `is_total`
- `source_file`
- `source_sheet`

### finance_fact_weekly_partial

Источник:
- `Данные для ДДС.xlsx`, `Лист2`

Назначение:
- хранить только те недельные значения, которые реально присутствуют в файле.

Поля:
- `week_date`
- `metric_group`
- `line_name`
- `fact_amount`
- `is_partial_fact`
- `source_file`
- `source_sheet`

Важно:
- это не полная история факта;
- использовать только как частичный подтвержденный факт в пределах доступного окна.

### finance_fact_full

Источник:
- `dashboard/data_workspace/manual/finance_actuals.csv`

Поля:
- `period_type`
- `period_start`
- `metric_group`
- `line_name`
- `fact_amount`
- `source_name`
- `comment`

Назначение:
- будущий полноценный источник факта для настоящего `plan/fact`.

### historical_april_plan_fact_weekly

Источник:
- `ДДС Апрель 2026 (-).xlsx`

Поля:
- `week_date`
- `metric_group`
- `line_name`
- `plan_amount`
- `fact_amount`
- `has_actual`
- `delta_amount`

Назначение:
- прошлый недельный `план/факт`, не смешанный с текущей оперативкой.

### erp_cashflow_monthly

Источник:
- `ДДС ЕРП (2025для отправки).xlsx`

Поля:
- `period_month`
- `operating_amount`
- `financial_amount`
- `investment_amount`
- `transfer_amount`
- `net_amount`

Назначение:
- месячная историческая фактура `ДДС ERP 2025`.

### erp_pnl_monthly

Источник:
- `ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx`

Поля:
- `period_month`
- `revenue_amount`
- `vp7_amount`

Назначение:
- компактный месячный исторический срез `ОПУ ERP 2025`.

### tenders

Источник:
- `Контур.Закупки_20.04.2026*.xlsx`

Поля:
- `tender_id`
- `tender_title`
- `nmck`
- `currency`
- `published_at`
- `deadline_at`
- `selection_stage`
- `trade_type`
- `selection_method`
- `platform`
- `customer_name`
- `customer_inn`
- `customer_kpp`
- `region`
- `delivery_location`
- `winner_name`
- `winner_bid`
- `is_filter_related`
- `source_file`

Важно:
- колонка `Название` должна быть разделена на:
  - `tender_title`
  - `customer_name`

### companies

Источник:
- `Бэкс - 06.02.2026 база на согласование.xlsx`

Поля:
- `company_id`
- `company_name`
- `inn`
- `primary_activity`
- `region`
- `city`
- `address`
- `phone`
- `employee_flag`
- `revenue_2024`
- `source_name`

### opportunities

Источник:
- `dashboard/data_workspace/manual/opportunities.csv`

Поля:
- `opportunity_id`
- `event_date`
- `customer_name`
- `customer_inn`
- `title`
- `expected_revenue`
- `probability`
- `status`
- `source_type`
- `source_ref`
- `next_step`
- `owner`
- `notes`

### lost_contracts

Источник:
- `dashboard/data_workspace/manual/lost_contracts.csv`

Поля:
- `lost_contract_id`
- `lost_date`
- `customer_name`
- `customer_inn`
- `contract_name`
- `amount_estimate`
- `source_type`
- `source_ref`
- `lost_reason`
- `lost_reason_group`
- `owner`
- `notes`

### production_status

Источник:
- `dashboard/data_workspace/manual/production_status.csv`

Поля:
- `snapshot_date`
- `contract_name`
- `customer_name`
- `planned_ship_date`
- `readiness_pct`
- `cogs_plan`
- `cogs_fact`
- `production_status`
- `revenue_recognition_ready`
- `notes`

## Ограничения текущего raw

- нет полноценного финансового факта за всё время;
- нет подтвержденных упущенных договоров;
- нет причин потерь;
- нет статусов pipeline;
- нет производственного статуса;
- нет связки `заключенный договор -> будущий доход`.

## Правила агрегации для UI

- месячный `plan/fact` строится только из месячного плана и подтвержденного факта;
- недельный экран показывает оперативный план и частичный факт только там, где он действительно загружен;
- тендерный экран показывает рынок, а не наши потери;
- блоки `pipeline`, `lost_contracts`, `production` работают только при наличии ручных данных.
