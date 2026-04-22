import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import type {
  DashboardData,
  ErpCashflowMonthlyRecord,
  ErpPnlMonthlyRecord,
  HistoricalWeeklyPlanFactRecord,
  MonthlyComparisonRecord,
  ScreenKey,
  WeeklyPlanLineRecord,
  WeeklySummaryRecord,
} from './types'
import {
  clampRange,
  formatCompact,
  formatMonthLabel,
  formatNumber,
  formatWeekLabel,
} from './utils'

const SCREEN_OPTIONS: Array<{ key: ScreenKey; label: string }> = [
  { key: 'operational', label: 'По неделям' },
  { key: 'plan-fact', label: 'По месяцам' },
  { key: 'historical', label: 'Прошлое' },
]

type ChartViewMode = 'all' | 'income' | 'expense'

const COLOR_PLAN = '#2563eb'
const COLOR_FACT = '#16a34a'
const COLOR_EXPENSE = '#ea580c'
const COLOR_FACT_EXPENSE = '#0f766e'
const COLOR_NEGATIVE = '#dc2626'
const COLOR_NEUTRAL = '#475569'
const COLOR_DELTA_BAD = '#dc2626'
const COLOR_DELTA_GOOD = '#f59e0b'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<ScreenKey>('operational')
  const [monthStart, setMonthStart] = useState(0)
  const [monthEnd, setMonthEnd] = useState(0)
  const [weekStart, setWeekStart] = useState(0)
  const [weekEnd, setWeekEnd] = useState(0)
  const [historyMonthStart, setHistoryMonthStart] = useState(0)
  const [historyMonthEnd, setHistoryMonthEnd] = useState(0)

  useEffect(() => {
    let active = true
    const dataUrl = `${import.meta.env.BASE_URL}data/dashboard-data.json`

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные дашборда')
        }
        return response.json() as Promise<DashboardData>
      })
      .then((payload) => {
        if (!active) {
          return
        }
        setData(payload)
        const monthOptions = uniqueSorted(payload.monthlyComparison.map((item) => item.period_month))
        const weekOptions = uniqueSorted(payload.weeklySummary.map((item) => item.week_date))
        const historyMonthOptions = uniqueSorted([
          ...payload.erpCashflowMonthly.map((item) => item.period_month),
          ...payload.erpPnlMonthly.map((item) => item.period_month),
        ])

        setMonthStart(0)
        setMonthEnd(Math.max(0, monthOptions.length - 1))
        setWeekStart(0)
        setWeekEnd(Math.max(0, weekOptions.length - 1))
        setHistoryMonthStart(0)
        setHistoryMonthEnd(Math.max(0, historyMonthOptions.length - 1))
      })
      .catch((error) => {
        console.error(error)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return <main className="app-shell loading-shell">Загрузка данных…</main>
  }

  if (!data) {
    return (
      <main className="app-shell loading-shell">
        Не удалось загрузить данные. Сначала выполните `npm run sync-data`.
      </main>
    )
  }

  const monthOptions = uniqueSorted(data.monthlyComparison.map((item) => item.period_month))
  const weekOptions = uniqueSorted(data.weeklySummary.map((item) => item.week_date))
  const historyMonthOptions = uniqueSorted([
    ...data.erpCashflowMonthly.map((item) => item.period_month),
    ...data.erpPnlMonthly.map((item) => item.period_month),
  ])

  const visibleMonths = clampRange(monthOptions, monthStart, monthEnd)
  const visibleWeeks = clampRange(weekOptions, weekStart, weekEnd)
  const visibleHistoricalMonths = clampRange(historyMonthOptions, historyMonthStart, historyMonthEnd)

  const filteredMonthly = data.monthlyComparison.filter((item) =>
    visibleMonths.includes(item.period_month),
  )
  const filteredWeekly = data.weeklySummary.filter((item) =>
    visibleWeeks.includes(item.week_date),
  )
  const filteredWeekLines = data.weeklyPlanLines.filter((item) =>
    visibleWeeks.includes(item.week_date),
  )
  const filteredHistoricalCashflow = data.erpCashflowMonthly.filter((item) =>
    visibleHistoricalMonths.length === 0 || visibleHistoricalMonths.includes(item.period_month),
  )
  const filteredHistoricalPnl = data.erpPnlMonthly.filter((item) =>
    visibleHistoricalMonths.length === 0 || visibleHistoricalMonths.includes(item.period_month),
  )

  return (
    <main className="app-shell">
      <div className="topbar">
        <nav className="screen-switcher" aria-label="Навигация по экранам">
          {SCREEN_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={option.key === screen ? 'screen-chip active' : 'screen-chip'}
              onClick={() => setScreen(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      {screen === 'operational' ? (
        <OperationalScreen
          items={filteredWeekly}
          weekLines={filteredWeekLines}
          weekOptions={weekOptions}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onWeekStartChange={(value) => {
            const nextStart = Number(value)
            setWeekStart(nextStart)
            if (nextStart > weekEnd) {
              setWeekEnd(nextStart)
            }
          }}
          onWeekEndChange={(value) => {
            const nextEnd = Number(value)
            setWeekEnd(nextEnd)
            if (nextEnd < weekStart) {
              setWeekStart(nextEnd)
            }
          }}
        />
      ) : null}

      {screen === 'plan-fact' ? (
        <PlanFactScreen
          items={filteredMonthly}
          monthOptions={monthOptions}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onMonthStartChange={(value) => {
            const nextStart = Number(value)
            setMonthStart(nextStart)
            if (nextStart > monthEnd) {
              setMonthEnd(nextStart)
            }
          }}
          onMonthEndChange={(value) => {
            const nextEnd = Number(value)
            setMonthEnd(nextEnd)
            if (nextEnd < monthStart) {
              setMonthStart(nextEnd)
            }
          }}
        />
      ) : null}

      {screen === 'historical' ? (
        <HistoricalScreen
          aprilItems={data.historicalWeeklyPlanFact}
          erpCashflowItems={filteredHistoricalCashflow}
          erpPnlItems={filteredHistoricalPnl}
          historyMonthOptions={historyMonthOptions}
          historyMonthStart={historyMonthStart}
          historyMonthEnd={historyMonthEnd}
          onHistoryMonthStartChange={(value) => {
            const nextStart = Number(value)
            setHistoryMonthStart(nextStart)
            if (nextStart > historyMonthEnd) {
              setHistoryMonthEnd(nextStart)
            }
          }}
          onHistoryMonthEndChange={(value) => {
            const nextEnd = Number(value)
            setHistoryMonthEnd(nextEnd)
            if (nextEnd < historyMonthStart) {
              setHistoryMonthStart(nextEnd)
            }
          }}
        />
      ) : null}
    </main>
  )
}

export default App

function OperationalScreen(props: {
  items: WeeklySummaryRecord[]
  weekLines: WeeklyPlanLineRecord[]
  weekOptions: string[]
  weekStart: number
  weekEnd: number
  onWeekStartChange: (value: string) => void
  onWeekEndChange: (value: string) => void
}) {
  const [chartMode, setChartMode] = useState<ChartViewMode>('all')
  const incomeItems = props.items.filter((item) => item.metric_group === 'income')
  const expenseItems = props.items.filter((item) => item.metric_group === 'expense')
  const incomeTotals = summarizeMetrics(incomeItems)
  const expenseTotals = summarizeMetrics(expenseItems)
  const periodLabel = buildRangeLabel(
    props.weekOptions[props.weekStart],
    props.weekOptions[props.weekEnd],
    formatWeekLabel,
  )

  return (
    <section className="screen-grid">
      <div className="control-row">
        <RangeSelect
          label="С"
          value={props.weekStart}
          options={props.weekOptions}
          formatLabel={formatWeekLabel}
          onChange={props.onWeekStartChange}
        />
        <RangeSelect
          label="По"
          value={props.weekEnd}
          options={props.weekOptions}
          formatLabel={formatWeekLabel}
          onChange={props.onWeekEndChange}
        />
      </div>

      <section className="summary-block">
        <div className="panel-head">
          <div className="summary-head">
            <span className="eyebrow">Всего за период</span>
            <strong>{periodLabel}</strong>
          </div>
        </div>
        <div className="summary-inline">
          <MetricTile label="План доходов" value={incomeTotals.plan} tone="plan" />
          <MetricTile label="План расходов" value={expenseTotals.plan} tone="expense" />
        </div>
      </section>

      <ChartPanel eyebrow="План по неделям">
        <div className="chart-toolbar">
          <ChartModeSwitch value={chartMode} onChange={setChartMode} />
        </div>
        <CombinedPlanChart
          items={props.items}
          mode={chartMode}
          dateFormatter={formatWeekLabel}
          dateKey="week_date"
        />
      </ChartPanel>

      <section className="table-panel">
        <div className="panel-head">
          <span className="eyebrow">Недельный срез</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Неделя</th>
                <th>План доходов</th>
                <th>План расходов</th>
              </tr>
            </thead>
            <tbody>
              {buildWeeklyTableRows(props.items).map((row) => (
                <tr key={row.week}>
                  <td data-label="Неделя">{formatWeekLabel(row.week)}</td>
                  <td data-label="План доходов">{formatNumber(row.incomePlan)}</td>
                  <td data-label="План расходов">{formatNumber(row.expensePlan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-panel">
        <div className="panel-head">
          <span className="eyebrow">Статьи недельного плана</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Неделя</th>
                <th>Тип</th>
                <th>Статья</th>
                <th>План</th>
              </tr>
            </thead>
            <tbody>
              {props.weekLines
                .filter((item) => !item.line_name.match(/^(Доход|Расход)$/))
                .map((line) => (
                  <tr key={`${line.week_date}-${line.metric_group}-${line.line_name}`}>
                    <td data-label="Неделя">{formatWeekLabel(line.week_date)}</td>
                    <td data-label="Тип">{line.metric_group === 'income' ? 'Доход' : 'Расход'}</td>
                    <td data-label="Статья">{line.line_name}</td>
                    <td data-label="План">{formatNumber(line.plan_amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function PlanFactScreen(props: {
  items: MonthlyComparisonRecord[]
  monthOptions: string[]
  monthStart: number
  monthEnd: number
  onMonthStartChange: (value: string) => void
  onMonthEndChange: (value: string) => void
}) {
  const [chartMode, setChartMode] = useState<ChartViewMode>('all')
  const incomeItems = props.items.filter((item) => item.metric_group === 'income')
  const expenseItems = props.items.filter((item) => item.metric_group === 'expense')
  const incomeTotals = summarizeMetrics(incomeItems)
  const expenseTotals = summarizeMetrics(expenseItems)
  const periodLabel = buildRangeLabel(
    props.monthOptions[props.monthStart],
    props.monthOptions[props.monthEnd],
    formatMonthLabel,
  )

  return (
    <section className="screen-grid">
      <div className="control-row">
        <RangeSelect
          label="С"
          value={props.monthStart}
          options={props.monthOptions}
          formatLabel={formatMonthLabel}
          onChange={props.onMonthStartChange}
        />
        <RangeSelect
          label="По"
          value={props.monthEnd}
          options={props.monthOptions}
          formatLabel={formatMonthLabel}
          onChange={props.onMonthEndChange}
        />
      </div>

      <section className="summary-block">
        <div className="panel-head">
          <div className="summary-head">
            <span className="eyebrow">Всего за период</span>
            <strong>{periodLabel}</strong>
          </div>
        </div>
        <div className="summary-inline">
          <MetricTile label="План доходов" value={incomeTotals.plan} tone="plan" />
          <MetricTile label="План расходов" value={expenseTotals.plan} tone="expense" />
        </div>
      </section>

      <ChartPanel eyebrow="План по месяцам">
        <div className="chart-toolbar">
          <ChartModeSwitch value={chartMode} onChange={setChartMode} />
        </div>
        <CombinedPlanChart
          items={props.items}
          mode={chartMode}
          dateFormatter={formatMonthLabel}
          dateKey="period_month"
        />
      </ChartPanel>
    </section>
  )
}

function HistoricalScreen(props: {
  aprilItems: HistoricalWeeklyPlanFactRecord[]
  erpCashflowItems: ErpCashflowMonthlyRecord[]
  erpPnlItems: ErpPnlMonthlyRecord[]
  historyMonthOptions: string[]
  historyMonthStart: number
  historyMonthEnd: number
  onHistoryMonthStartChange: (value: string) => void
  onHistoryMonthEndChange: (value: string) => void
}) {
  const [chartMode, setChartMode] = useState<ChartViewMode>('all')
  const aprilIncomeTotals = summarizeMetrics(props.aprilItems.filter((item) => item.metric_group === 'income'))
  const aprilExpenseTotals = summarizeMetrics(props.aprilItems.filter((item) => item.metric_group === 'expense'))
  const aprilIncomeDeltaTone = getDeltaTone('income', aprilIncomeTotals.delta, aprilIncomeTotals.hasActual)
  const aprilExpenseDeltaTone = getDeltaTone(
    'expense',
    aprilExpenseTotals.delta,
    aprilExpenseTotals.hasActual,
  )
  const aprilFactBalance = aprilIncomeTotals.fact - aprilExpenseTotals.fact
  const aprilRangeLabel =
    props.aprilItems.length > 0
      ? buildRangeLabel(
          props.aprilItems[0]?.week_date,
          props.aprilItems[props.aprilItems.length - 1]?.week_date,
          formatWeekLabel,
        )
      : 'нет данных'
  const historyRangeLabel =
    props.historyMonthOptions.length > 0
      ? buildRangeLabel(
          props.historyMonthOptions[props.historyMonthStart],
          props.historyMonthOptions[props.historyMonthEnd],
          formatMonthLabel,
        )
      : 'нет данных'
  const cashflowTotals = summarizeCashflow(props.erpCashflowItems)
  const pnlTotals = summarizePnl(props.erpPnlItems)

  if (
    props.aprilItems.length === 0 &&
    props.erpCashflowItems.length === 0 &&
    props.erpPnlItems.length === 0
  ) {
    return (
      <section className="screen-grid">
        <section className="chart-panel">
          <div className="empty-state">
            Исторические файлы не найдены. Для этого экрана нужны `ДДС Апрель 2026`, `ДДС ЕРП 2025` и
            `ОПУ ЕРП 2025`.
          </div>
        </section>
      </section>
    )
  }

  return (
    <section className="screen-grid">
      {props.historyMonthOptions.length > 0 ? (
        <div className="control-row">
          <RangeSelect
            label="История с"
            value={props.historyMonthStart}
            options={props.historyMonthOptions}
            formatLabel={formatMonthLabel}
            onChange={props.onHistoryMonthStartChange}
          />
          <RangeSelect
            label="История по"
            value={props.historyMonthEnd}
            options={props.historyMonthOptions}
            formatLabel={formatMonthLabel}
            onChange={props.onHistoryMonthEndChange}
          />
        </div>
      ) : null}

      {props.aprilItems.length > 0 ? (
        <>
          <section className="summary-block">
            <div className="panel-head">
              <div className="summary-head">
                <span className="eyebrow">Прошлый период</span>
                <strong>{aprilRangeLabel}</strong>
              </div>
            </div>
            <div className="summary-stack">
              <div className="summary-quad">
                <MetricTile label="План поступлений" value={aprilIncomeTotals.plan} tone="plan" compact />
                <MetricTile label="Факт поступлений" value={aprilIncomeTotals.fact} tone="fact" compact />
                <MetricTile label="План списаний" value={aprilExpenseTotals.plan} tone="expense" compact />
                <MetricTile label="Факт списаний" value={aprilExpenseTotals.fact} tone="fact" compact />
              </div>
              <div className="summary-strip summary-strip-trio">
                <MetricTile
                  label="Разница доходов"
                  value={formatSignedNumber(aprilIncomeTotals.delta)}
                  tone={tileToneFromDelta(aprilIncomeDeltaTone)}
                  compact
                />
                <MetricTile
                  label="Разница расходов"
                  value={formatSignedNumber(aprilExpenseTotals.delta)}
                  tone={tileToneFromDelta(aprilExpenseDeltaTone)}
                  compact
                />
                <MetricTile
                  label="Факт доходы − расходы"
                  value={formatSignedNumber(aprilFactBalance)}
                  tone={tileToneFromBalance(aprilFactBalance)}
                  compact
                />
              </div>
            </div>
          </section>

          <ChartPanel eyebrow="Апрель 2026 · план / факт по неделям">
            <div className="chart-toolbar">
              <ChartModeSwitch value={chartMode} onChange={setChartMode} />
            </div>
            <CombinedPlanChart
              items={props.aprilItems}
              mode={chartMode}
              dateFormatter={formatWeekLabel}
              dateKey="week_date"
              highlightDelta
              preserveZeroFacts
            />
          </ChartPanel>

          <DetailsSection title="Детализация апреля 2026">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Неделя</th>
                    <th>План поступлений</th>
                    <th>Факт поступлений</th>
                    <th>Разница</th>
                    <th>План списаний</th>
                    <th>Факт списаний</th>
                    <th>Разница</th>
                  </tr>
                </thead>
                <tbody>
                  {buildHistoricalWeeklyRows(props.aprilItems).map((row) => (
                    <tr key={row.week}>
                      <td data-label="Неделя">{formatWeekLabel(row.week)}</td>
                      <td data-label="План поступлений">{formatNumber(row.incomePlan)}</td>
                      <td data-label="Факт поступлений">{formatNumber(row.incomeFact)}</td>
                      <td data-label="Разница">
                        <span className={deltaClassName(row.incomeTone)}>
                          {formatSignedNumber(row.incomeDelta)}
                        </span>
                      </td>
                      <td data-label="План списаний">{formatNumber(row.expensePlan)}</td>
                      <td data-label="Факт списаний">{formatNumber(row.expenseFact)}</td>
                      <td data-label="Разница">
                        <span className={deltaClassName(row.expenseTone)}>
                          {formatSignedNumber(row.expenseDelta)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailsSection>
        </>
      ) : null}

      {props.erpCashflowItems.length > 0 ? (
        <>
          <section className="summary-block">
            <div className="panel-head">
              <div className="summary-head">
                <span className="eyebrow">Движение денег 2025</span>
                <strong>{historyRangeLabel}</strong>
              </div>
            </div>
            <div className="summary-inline">
              <MetricTile label="Суммарный итог" value={cashflowTotals.net} tone="neutral" compact />
              <MetricTile label="Финансовая деятельность" value={cashflowTotals.financial} tone="good" compact />
            </div>
          </section>

          <ChartPanel eyebrow="Движение денег 2025 · общий итог">
            <HistoricalCashflowChart items={props.erpCashflowItems} />
          </ChartPanel>

          <DetailsSection title="Детализация движения денег 2025">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Операционная</th>
                    <th>Финансовая</th>
                    <th>Инвестиционная</th>
                    <th>Переводы</th>
                    <th>Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {props.erpCashflowItems.map((item) => (
                    <tr key={item.period_month}>
                      <td data-label="Месяц">{formatMonthLabel(item.period_month)}</td>
                      <td data-label="Операционная">{formatNumber(item.operating_amount)}</td>
                      <td data-label="Финансовая">{formatNumber(item.financial_amount)}</td>
                      <td data-label="Инвестиционная">{formatNumber(item.investment_amount)}</td>
                      <td data-label="Переводы">{formatNumber(item.transfer_amount)}</td>
                      <td data-label="Итог">{formatNumber(item.net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailsSection>
        </>
      ) : null}

      {props.erpPnlItems.length > 0 ? (
        <>
          <section className="summary-block">
            <div className="panel-head">
              <div className="summary-head">
                <span className="eyebrow">Прибыль и убытки 2025</span>
                <strong>{historyRangeLabel}</strong>
              </div>
            </div>
            <div className="summary-inline">
              <MetricTile label="Выручка" value={pnlTotals.revenue} tone="plan" compact />
              <MetricTile label="Валовая прибыль" value={pnlTotals.vp7} tone="neutral" compact />
            </div>
          </section>

          <ChartPanel eyebrow="Прибыль и убытки 2025 · выручка и валовая прибыль">
            <HistoricalPnlChart items={props.erpPnlItems} />
          </ChartPanel>

          <DetailsSection title="Детализация прибыли и убытков 2025">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Выручка</th>
                    <th>Валовая прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {props.erpPnlItems.map((item) => (
                    <tr key={item.period_month}>
                      <td data-label="Месяц">{formatMonthLabel(item.period_month)}</td>
                      <td data-label="Выручка">{formatNumber(item.revenue_amount)}</td>
                      <td data-label="Валовая прибыль">{formatNumber(item.vp7_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailsSection>
        </>
      ) : null}
    </section>
  )
}

function CombinedPlanChart(props: {
  items: Array<WeeklySummaryRecord | MonthlyComparisonRecord | HistoricalWeeklyPlanFactRecord>
  mode: ChartViewMode
  dateKey: 'week_date' | 'period_month'
  dateFormatter: (value: string) => string
  highlightDelta?: boolean
  preserveZeroFacts?: boolean
}) {
  const rows = buildCombinedChartRows(
    props.items,
    props.dateKey,
    props.dateFormatter,
    props.preserveZeroFacts,
  )
  const showIncome = props.mode === 'all' || props.mode === 'income'
  const showExpense = props.mode === 'all' || props.mode === 'expense'
  const showIncomeFact =
    showIncome &&
    rows.some(
      (row) => row.incomeFact !== null && (props.preserveZeroFacts || row.incomeFact !== 0),
    )
  const showExpenseFact =
    showExpense &&
    rows.some(
      (row) => row.expenseFact !== null && (props.preserveZeroFacts || row.expenseFact !== 0),
    )

  if (props.highlightDelta) {
    const varianceRows = buildVarianceBarRows(rows)

    return (
      <div className="chart-short">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={varianceRows} barGap={0} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
            <Tooltip cursor={false} content={<VarianceTooltip mode={props.mode} />} />
            {showIncomeFact ? (
              <Bar dataKey="incomeFactBase" stackId="incomeFact" fill={COLOR_FACT} legendType="none">
                {varianceRows.map((row) => (
                  <Cell key={`income-fact-base-${row.label}`} fill={COLOR_FACT} />
                ))}
              </Bar>
            ) : null}
            {showIncomeFact ? (
              <Bar
                dataKey="incomeFactDelta"
                stackId="incomeFact"
                radius={[8, 8, 0, 0]}
                legendType="none"
              >
                {varianceRows.map((row) => (
                  <Cell
                    key={`income-fact-delta-${row.label}`}
                    fill={deltaFillColor(row.incomeDeltaTone)}
                  />
                ))}
              </Bar>
            ) : null}
            {showIncome ? (
              <Bar
                dataKey="incomePlan"
                stackId="incomePlan"
                fill={COLOR_PLAN}
                radius={[8, 8, 0, 0]}
                legendType="none"
              />
            ) : null}
            {showIncome && showExpense ? (
              <Bar
                dataKey="groupSpacer"
                stackId="groupSpacer"
                fill="transparent"
                legendType="none"
                isAnimationActive={false}
              />
            ) : null}
            {showExpenseFact ? (
              <Bar
                dataKey="expenseFactBase"
                stackId="expenseFact"
                fill={COLOR_FACT_EXPENSE}
                legendType="none"
              >
                {varianceRows.map((row) => (
                  <Cell key={`expense-fact-base-${row.label}`} fill={COLOR_FACT_EXPENSE} />
                ))}
              </Bar>
            ) : null}
            {showExpenseFact ? (
              <Bar
                dataKey="expenseFactDelta"
                stackId="expenseFact"
                radius={[8, 8, 0, 0]}
                legendType="none"
              >
                {varianceRows.map((row) => (
                  <Cell
                    key={`expense-fact-delta-${row.label}`}
                    fill={deltaFillColor(row.expenseDeltaTone)}
                  />
                ))}
              </Bar>
            ) : null}
            {showExpense ? (
              <Bar
                dataKey="expensePlan"
                stackId="expensePlan"
                fill={COLOR_EXPENSE}
                radius={[8, 8, 0, 0]}
                legendType="none"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
        <PlanFactLegend mode={props.mode} />
      </div>
    )
  }

  return (
    <div className="chart-short">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} barGap={3} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<CombinedTooltip showDelta={props.highlightDelta} />} />
          <Legend />
          {showIncomeFact ? (
            <Bar dataKey="incomeFact" fill={COLOR_FACT} radius={[8, 8, 0, 0]} name="Факт доходов">
              {rows.map((row) => (
                <Cell
                  key={`income-fact-${row.label}`}
                  fill={COLOR_FACT}
                  stroke={
                    props.highlightDelta && row.incomeDeltaTone !== 'neutral'
                      ? row.incomeDeltaTone === 'bad'
                        ? COLOR_DELTA_BAD
                        : COLOR_DELTA_GOOD
                      : 'transparent'
                  }
                  strokeWidth={props.highlightDelta && row.incomeDeltaTone !== 'neutral' ? 3 : 0}
                />
              ))}
            </Bar>
          ) : null}
          {showIncome ? (
            <Bar dataKey="incomePlan" fill={COLOR_PLAN} radius={[8, 8, 0, 0]} name="План доходов" />
          ) : null}
          {showIncome && showExpense ? (
            <Bar dataKey="groupSpacer" fill="transparent" legendType="none" isAnimationActive={false} />
          ) : null}
          {showExpenseFact ? (
            <Bar
              dataKey="expenseFact"
              fill={COLOR_FACT_EXPENSE}
              radius={[8, 8, 0, 0]}
              name="Факт расходов"
            >
              {rows.map((row) => (
                <Cell
                  key={`expense-fact-${row.label}`}
                  fill={COLOR_FACT_EXPENSE}
                  stroke={
                    props.highlightDelta && row.expenseDeltaTone !== 'neutral'
                      ? row.expenseDeltaTone === 'bad'
                        ? COLOR_DELTA_BAD
                        : COLOR_DELTA_GOOD
                      : 'transparent'
                  }
                  strokeWidth={props.highlightDelta && row.expenseDeltaTone !== 'neutral' ? 3 : 0}
                />
              ))}
            </Bar>
          ) : null}
          {showExpense ? (
            <Bar dataKey="expensePlan" fill={COLOR_EXPENSE} radius={[8, 8, 0, 0]} name="План расходов" />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HistoricalCashflowChart(props: { items: ErpCashflowMonthlyRecord[] }) {
  const rows = props.items.map((item) => ({
    label: formatMonthLabel(item.period_month),
    netAmount: item.net_amount,
  }))

  return (
    <div className="chart-short">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<CombinedTooltip />} />
          <Bar dataKey="netAmount" radius={[8, 8, 0, 0]} name="Общий итог">
            {rows.map((row) => (
              <Cell key={row.label} fill={row.netAmount >= 0 ? COLOR_FACT : COLOR_NEGATIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HistoricalPnlChart(props: { items: ErpPnlMonthlyRecord[] }) {
  const rows = props.items.map((item) => ({
    label: formatMonthLabel(item.period_month),
    revenueAmount: item.revenue_amount,
    vp7Amount: item.vp7_amount,
  }))

  return (
    <div className="chart-short">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} barGap={10}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<CombinedTooltip />} />
          <Legend />
          <Bar dataKey="revenueAmount" fill={COLOR_PLAN} radius={[8, 8, 0, 0]} name="Выручка" />
          <Bar
            dataKey="vp7Amount"
            fill={COLOR_NEUTRAL}
            radius={[8, 8, 0, 0]}
            name="Валовая прибыль"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DetailsSection(props: { title: string; children: ReactNode }) {
  return (
    <details className="details-panel">
      <summary className="details-summary">{props.title}</summary>
      <div className="details-body">{props.children}</div>
    </details>
  )
}

function VarianceTooltip(props: {
  active?: boolean
  payload?: Array<{
    payload?: VarianceBarRow
  }>
  mode: ChartViewMode
}) {
  if (!props.active || !props.payload?.length) {
    return null
  }

  const row = props.payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="tooltip">
      <div className="tooltip-title">{row.label}</div>
      {(props.mode === 'all' || props.mode === 'income') && row.incomeFact !== null ? (
        <>
          <div className="tooltip-line">
            <span>План доходов</span>
            <strong>{formatNumber(row.incomePlan)}</strong>
          </div>
          <div className="tooltip-line">
            <span>Факт доходов</span>
            <strong>{formatNumber(row.incomeFact)}</strong>
          </div>
          <div className={`tooltip-line ${deltaClassName(row.incomeDeltaTone)}`}>
            <span>Разница доходов</span>
            <strong>{formatSignedNumber(row.incomeDelta ?? 0)}</strong>
          </div>
        </>
      ) : null}
      {(props.mode === 'all' || props.mode === 'expense') && row.expenseFact !== null ? (
        <>
          <div className="tooltip-line">
            <span>План расходов</span>
            <strong>{formatNumber(row.expensePlan)}</strong>
          </div>
          <div className="tooltip-line">
            <span>Факт расходов</span>
            <strong>{formatNumber(row.expenseFact)}</strong>
          </div>
          <div className={`tooltip-line ${deltaClassName(row.expenseDeltaTone)}`}>
            <span>Разница расходов</span>
            <strong>{formatSignedNumber(row.expenseDelta ?? 0)}</strong>
          </div>
        </>
      ) : null}
    </div>
  )
}

function PlanFactLegend(props: { mode: ChartViewMode }) {
  return (
    <div className="custom-legend">
      {props.mode !== 'expense' ? (
        <>
          <LegendItem color={COLOR_FACT} label="Факт доходов" />
          <LegendItem color={COLOR_PLAN} label="План доходов" />
        </>
      ) : null}
      {props.mode === 'all' ? <span className="legend-gap" /> : null}
      {props.mode !== 'income' ? (
        <>
          <LegendItem color={COLOR_FACT_EXPENSE} label="Факт расходов" />
          <LegendItem color={COLOR_EXPENSE} label="План расходов" />
        </>
      ) : null}
    </div>
  )
}

function LegendItem(props: { color: string; label: string }) {
  return (
    <span className="legend-item">
      <i style={{ backgroundColor: props.color }} />
      {props.label}
    </span>
  )
}

function CombinedTooltip(props: {
  active?: boolean
  label?: string
  payload?: Array<{
    name: string
    value: number
    color: string
    payload?: {
      incomeDelta?: number | null
      expenseDelta?: number | null
      incomeDeltaTone?: DeltaTone
      expenseDeltaTone?: DeltaTone
    }
  }>
  showDelta?: boolean
}) {
  if (!props.active || !props.payload?.length) {
    return null
  }

  const row = props.payload[0]?.payload

  return (
    <div className="tooltip">
      <div className="tooltip-title">{props.label}</div>
      {props.payload
        .filter((item) => item.value !== null && item.value !== undefined)
        .map((item) => (
          <div className="tooltip-line" key={item.name}>
            <span className="tooltip-series">
              <i style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      {props.showDelta && row && row.incomeDelta !== undefined && row.incomeDelta !== null ? (
        <div className={`tooltip-line ${deltaClassName(row.incomeDeltaTone ?? 'neutral')}`}>
          <span>Разница доходов</span>
          <strong>{formatSignedNumber(row.incomeDelta)}</strong>
        </div>
      ) : null}
      {props.showDelta && row && row.expenseDelta !== undefined && row.expenseDelta !== null ? (
        <div className={`tooltip-line ${deltaClassName(row.expenseDeltaTone ?? 'neutral')}`}>
          <span>Разница расходов</span>
          <strong>{formatSignedNumber(row.expenseDelta)}</strong>
        </div>
      ) : null}
    </div>
  )
}

function ChartPanel(props: {
  eyebrow: string
  status?: { label: string; tone: 'good' | 'bad' | 'neutral' }
  children: ReactNode
}) {
  return (
    <section className="chart-panel">
      <div className="panel-head">
        <span className="eyebrow">{props.eyebrow}</span>
        {props.status ? <StatusBadge tone={props.status.tone} label={props.status.label} /> : null}
      </div>
      {props.children}
    </section>
  )
}

function ChartModeSwitch(props: {
  value: ChartViewMode
  onChange: (value: ChartViewMode) => void
}) {
  return (
    <div className="chart-mode-switch" role="tablist" aria-label="Режим графика">
      {[
        ['all', 'Вместе'],
        ['income', 'Доходы'],
        ['expense', 'Расходы'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={props.value === value ? 'mode-chip active' : 'mode-chip'}
          onClick={() => props.onChange(value as ChartViewMode)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function RangeSelect(props: {
  label: string
  value: number
  options: string[]
  formatLabel: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <label className="range-select">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option, index) => (
          <option key={option} value={index}>
            {props.formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge(props: { label: string; tone: 'good' | 'bad' | 'neutral' }) {
  return <span className={`status-badge tone-${props.tone}`}>{props.label}</span>
}

function MetricTile(props: {
  label: string
  value: number | string
  tone: 'plan' | 'fact' | 'expense' | 'neutral' | 'good' | 'bad'
  compact?: boolean
  muted?: boolean
}) {
  const className = [
    'metric-tile',
    `tile-${props.tone}`,
    props.compact ? 'compact' : '',
    props.muted ? 'muted' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <span>{props.label}</span>
      <strong>{typeof props.value === 'number' ? formatNumber(props.value) : props.value}</strong>
    </div>
  )
}

function summarizeMetrics(
  items: Array<WeeklySummaryRecord | MonthlyComparisonRecord | HistoricalWeeklyPlanFactRecord>,
) {
  const hasActual = items.some((item) => item.has_actual)
  const plan = items.reduce((sum, item) => sum + item.plan_amount, 0)
  const fact = hasActual
    ? items.reduce((sum, item) => sum + (item.has_actual ? item.fact_amount : 0), 0)
    : 0
  const delta = hasActual ? fact - plan : 0
  return { plan, fact, delta, hasActual }
}

function tileToneFromDelta(tone: DeltaTone): 'good' | 'bad' | 'neutral' {
  if (tone === 'good') {
    return 'good'
  }
  if (tone === 'bad') {
    return 'bad'
  }
  return 'neutral'
}

function tileToneFromBalance(value: number): 'good' | 'bad' | 'neutral' {
  if (value > 0) {
    return 'good'
  }
  if (value < 0) {
    return 'bad'
  }
  return 'neutral'
}

function summarizeCashflow(items: ErpCashflowMonthlyRecord[]) {
  return items.reduce(
    (totals, item) => ({
      operating: totals.operating + item.operating_amount,
      financial: totals.financial + item.financial_amount,
      investment: totals.investment + item.investment_amount,
      net: totals.net + item.net_amount,
    }),
    { operating: 0, financial: 0, investment: 0, net: 0 },
  )
}

function summarizePnl(items: ErpPnlMonthlyRecord[]) {
  return items.reduce(
    (totals, item) => ({
      revenue: totals.revenue + item.revenue_amount,
      vp7: totals.vp7 + item.vp7_amount,
    }),
    { revenue: 0, vp7: 0 },
  )
}

function buildWeeklyTableRows(items: WeeklySummaryRecord[]) {
  const map = new Map<string, { week: string; incomePlan: number; expensePlan: number }>()

  items.forEach((item) => {
    const existing = map.get(item.week_date) ?? {
      week: item.week_date,
      incomePlan: 0,
      expensePlan: 0,
    }
    if (item.metric_group === 'income') {
      existing.incomePlan = item.plan_amount
    } else {
      existing.expensePlan = item.plan_amount
    }
    map.set(item.week_date, existing)
  })

  return Array.from(map.values())
}

function buildHistoricalWeeklyRows(items: HistoricalWeeklyPlanFactRecord[]) {
  const map = new Map<
    string,
    {
      week: string
      incomePlan: number
      incomeFact: number
      incomeDelta: number
      incomeTone: DeltaTone
      expensePlan: number
      expenseFact: number
      expenseDelta: number
      expenseTone: DeltaTone
    }
  >()

  items.forEach((item) => {
    const existing = map.get(item.week_date) ?? {
      week: item.week_date,
      incomePlan: 0,
      incomeFact: 0,
      incomeDelta: 0,
      incomeTone: 'neutral' as DeltaTone,
      expensePlan: 0,
      expenseFact: 0,
      expenseDelta: 0,
      expenseTone: 'neutral' as DeltaTone,
    }
    if (item.metric_group === 'income') {
      existing.incomePlan = item.plan_amount
      existing.incomeFact = item.fact_amount
      existing.incomeDelta = item.delta_amount
      existing.incomeTone = getDeltaTone('income', item.delta_amount, item.has_actual)
    } else {
      existing.expensePlan = item.plan_amount
      existing.expenseFact = item.fact_amount
      existing.expenseDelta = item.delta_amount
      existing.expenseTone = getDeltaTone('expense', item.delta_amount, item.has_actual)
    }
    map.set(item.week_date, existing)
  })

  return Array.from(map.values())
}

function buildCombinedChartRows(
  items: Array<WeeklySummaryRecord | MonthlyComparisonRecord | HistoricalWeeklyPlanFactRecord>,
  dateKey: 'week_date' | 'period_month',
  dateFormatter: (value: string) => string,
  preserveZeroFacts = false,
) {
  const map = new Map<
    string,
    {
      label: string
      incomePlan: number
      incomeFact: number | null
      incomeDelta: number | null
      incomeDeltaTone: DeltaTone
      expensePlan: number
      expenseFact: number | null
      expenseDelta: number | null
      expenseDeltaTone: DeltaTone
      groupSpacer: number
    }
  >()

  items.forEach((item) => {
    const periodValue =
      dateKey === 'week_date'
        ? (item as WeeklySummaryRecord | HistoricalWeeklyPlanFactRecord).week_date
        : (item as MonthlyComparisonRecord).period_month

    const row = map.get(periodValue) ?? {
      label: dateFormatter(periodValue),
      incomePlan: 0,
      incomeFact: null,
      incomeDelta: null,
      incomeDeltaTone: 'neutral',
      expensePlan: 0,
      expenseFact: null,
      expenseDelta: null,
      expenseDeltaTone: 'neutral',
      groupSpacer: 0,
    }

    if (item.metric_group === 'income') {
      row.incomePlan = item.plan_amount
      row.incomeFact = item.has_actual ? item.fact_amount : null
      if (!preserveZeroFacts && row.incomeFact === 0) {
        row.incomeFact = null
      }
      row.incomeDelta = item.has_actual ? item.delta_amount : null
      row.incomeDeltaTone = getDeltaTone('income', item.delta_amount, item.has_actual)
    } else {
      row.expensePlan = item.plan_amount
      row.expenseFact = item.has_actual ? item.fact_amount : null
      if (!preserveZeroFacts && row.expenseFact === 0) {
        row.expenseFact = null
      }
      row.expenseDelta = item.has_actual ? item.delta_amount : null
      row.expenseDeltaTone = getDeltaTone('expense', item.delta_amount, item.has_actual)
    }

    map.set(periodValue, row)
  })

  return Array.from(map.values())
}

type VarianceBarRow = {
  label: string
  incomeFactBase: number
  incomeFactDelta: number
  incomePlan: number
  groupSpacer: number
  expenseFactBase: number
  expenseFactDelta: number
  expensePlan: number
  incomeFact: number | null
  incomeDelta: number | null
  incomeDeltaTone: DeltaTone
  expenseFact: number | null
  expenseDelta: number | null
  expenseDeltaTone: DeltaTone
}

function buildVarianceBarRows(
  rows: Array<{
    label: string
    incomePlan: number
    incomeFact: number | null
    incomeDelta: number | null
    incomeDeltaTone: DeltaTone
    expensePlan: number
    expenseFact: number | null
    expenseDelta: number | null
    expenseDeltaTone: DeltaTone
    groupSpacer: number
  }>,
): VarianceBarRow[] {
  return rows.map((row) => ({
    label: row.label,
    incomeFactBase: row.incomeFact === null ? 0 : Math.min(row.incomePlan, row.incomeFact),
    incomeFactDelta: row.incomeFact === null ? 0 : Math.abs(row.incomeFact - row.incomePlan),
    incomePlan: row.incomePlan,
    groupSpacer: 0,
    expenseFactBase: row.expenseFact === null ? 0 : Math.min(row.expensePlan, row.expenseFact),
    expenseFactDelta: row.expenseFact === null ? 0 : Math.abs(row.expenseFact - row.expensePlan),
    expensePlan: row.expensePlan,
    incomeFact: row.incomeFact,
    incomeDelta: row.incomeDelta,
    incomeDeltaTone: row.incomeDeltaTone,
    expenseFact: row.expenseFact,
    expenseDelta: row.expenseDelta,
    expenseDeltaTone: row.expenseDeltaTone,
  }))
}

function buildRangeLabel(
  startValue: string | undefined,
  endValue: string | undefined,
  formatter: (value: string) => string,
) {
  if (!startValue || !endValue) {
    return 'весь доступный период'
  }
  if (startValue === endValue) {
    return formatter(startValue)
  }
  return `${formatter(startValue)} – ${formatter(endValue)}`
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

type DeltaTone = 'good' | 'bad' | 'neutral'

function getDeltaTone(
  metricGroup: 'income' | 'expense',
  deltaAmount: number,
  hasActual: boolean,
): DeltaTone {
  if (!hasActual || Math.abs(deltaAmount) < 0.0001) {
    return 'neutral'
  }
  if (metricGroup === 'income') {
    return deltaAmount > 0 ? 'good' : 'bad'
  }
  return deltaAmount > 0 ? 'bad' : 'good'
}

function formatSignedNumber(value: number) {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${prefix}${formatNumber(Math.abs(value))}`
}

function deltaClassName(tone: DeltaTone) {
  if (tone === 'good') {
    return 'delta-good'
  }
  if (tone === 'bad') {
    return 'delta-bad'
  }
  return 'delta-neutral'
}

function deltaFillColor(tone: DeltaTone) {
  if (tone === 'good') {
    return COLOR_DELTA_GOOD
  }
  if (tone === 'bad') {
    return COLOR_DELTA_BAD
  }
  return 'transparent'
}
