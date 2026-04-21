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
            <div className="summary-quad">
              <MetricTile label="План поступлений" value={aprilIncomeTotals.plan} tone="plan" compact />
              <MetricTile label="Факт поступлений" value={aprilIncomeTotals.fact} tone="fact" compact />
              <MetricTile label="План списаний" value={aprilExpenseTotals.plan} tone="expense" compact />
              <MetricTile label="Факт списаний" value={aprilExpenseTotals.fact} tone="fact" compact />
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
            />
          </ChartPanel>

          <section className="table-panel">
            <div className="panel-head">
              <span className="eyebrow">Апрель 2026 · недельный срез</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Неделя</th>
                    <th>План поступлений</th>
                    <th>Факт поступлений</th>
                    <th>План списаний</th>
                    <th>Факт списаний</th>
                  </tr>
                </thead>
                <tbody>
                  {buildHistoricalWeeklyRows(props.aprilItems).map((row) => (
                    <tr key={row.week}>
                      <td data-label="Неделя">{formatWeekLabel(row.week)}</td>
                      <td data-label="План поступлений">{formatNumber(row.incomePlan)}</td>
                      <td data-label="Факт поступлений">{formatNumber(row.incomeFact)}</td>
                      <td data-label="План списаний">{formatNumber(row.expensePlan)}</td>
                      <td data-label="Факт списаний">{formatNumber(row.expenseFact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {props.erpCashflowItems.length > 0 ? (
        <>
          <section className="summary-block">
            <div className="panel-head">
              <div className="summary-head">
                <span className="eyebrow">ДДС ERP 2025</span>
                <strong>{historyRangeLabel}</strong>
              </div>
            </div>
            <div className="summary-inline">
              <MetricTile label="Суммарный итог" value={cashflowTotals.net} tone="neutral" compact />
              <MetricTile label="Финансовая деятельность" value={cashflowTotals.financial} tone="good" compact />
            </div>
          </section>

          <ChartPanel eyebrow="ДДС ERP 2025 · общий итог">
            <HistoricalCashflowChart items={props.erpCashflowItems} />
          </ChartPanel>

          <section className="table-panel">
            <div className="panel-head">
              <span className="eyebrow">ДДС ERP 2025 · детализация</span>
            </div>
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
          </section>
        </>
      ) : null}

      {props.erpPnlItems.length > 0 ? (
        <>
          <section className="summary-block">
            <div className="panel-head">
              <div className="summary-head">
                <span className="eyebrow">ОПУ ERP 2025</span>
                <strong>{historyRangeLabel}</strong>
              </div>
            </div>
            <div className="summary-inline">
              <MetricTile label="Выручка" value={pnlTotals.revenue} tone="plan" compact />
              <MetricTile label="ВП 7" value={pnlTotals.vp7} tone="neutral" compact />
            </div>
          </section>

          <ChartPanel eyebrow="ОПУ ERP 2025 · выручка и ВП 7">
            <HistoricalPnlChart items={props.erpPnlItems} />
          </ChartPanel>

          <section className="table-panel">
            <div className="panel-head">
              <span className="eyebrow">ОПУ ERP 2025 · детализация</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Выручка</th>
                    <th>ВП 7</th>
                  </tr>
                </thead>
                <tbody>
                  {props.erpPnlItems.map((item) => (
                    <tr key={item.period_month}>
                      <td data-label="Месяц">{formatMonthLabel(item.period_month)}</td>
                      <td data-label="Выручка">{formatNumber(item.revenue_amount)}</td>
                      <td data-label="ВП 7">{formatNumber(item.vp7_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
}) {
  const rows = buildCombinedChartRows(props.items, props.dateKey, props.dateFormatter)
  const showIncome = props.mode === 'all' || props.mode === 'income'
  const showExpense = props.mode === 'all' || props.mode === 'expense'
  const showIncomeFact = showIncome && rows.some((row) => row.incomeFact !== null && row.incomeFact !== 0)
  const showExpenseFact =
    showExpense && rows.some((row) => row.expenseFact !== null && row.expenseFact !== 0)

  return (
    <div className="chart-short">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} barGap={10}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<CombinedTooltip />} />
          <Legend />
          {showIncome ? (
            <Bar dataKey="incomePlan" fill={COLOR_PLAN} radius={[8, 8, 0, 0]} name="План доходов" />
          ) : null}
          {showIncomeFact ? (
            <Bar dataKey="incomeFact" fill={COLOR_FACT} radius={[8, 8, 0, 0]} name="Факт доходов" />
          ) : null}
          {showExpense ? (
            <Bar dataKey="expensePlan" fill={COLOR_EXPENSE} radius={[8, 8, 0, 0]} name="План расходов" />
          ) : null}
          {showExpenseFact ? (
            <Bar
              dataKey="expenseFact"
              fill={COLOR_FACT_EXPENSE}
              radius={[8, 8, 0, 0]}
              name="Факт расходов"
            />
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
          <Bar dataKey="vp7Amount" fill={COLOR_NEUTRAL} radius={[8, 8, 0, 0]} name="ВП 7" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CombinedTooltip(props: {
  active?: boolean
  label?: string
  payload?: Array<{
    name: string
    value: number
    color: string
  }>
}) {
  if (!props.active || !props.payload?.length) {
    return null
  }

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
  tone: 'plan' | 'fact' | 'expense' | 'neutral' | 'good'
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
      expensePlan: number
      expenseFact: number
    }
  >()

  items.forEach((item) => {
    const existing = map.get(item.week_date) ?? {
      week: item.week_date,
      incomePlan: 0,
      incomeFact: 0,
      expensePlan: 0,
      expenseFact: 0,
    }
    if (item.metric_group === 'income') {
      existing.incomePlan = item.plan_amount
      existing.incomeFact = item.fact_amount
    } else {
      existing.expensePlan = item.plan_amount
      existing.expenseFact = item.fact_amount
    }
    map.set(item.week_date, existing)
  })

  return Array.from(map.values())
}

function buildCombinedChartRows(
  items: Array<WeeklySummaryRecord | MonthlyComparisonRecord | HistoricalWeeklyPlanFactRecord>,
  dateKey: 'week_date' | 'period_month',
  dateFormatter: (value: string) => string,
) {
  const map = new Map<
    string,
    {
      label: string
      incomePlan: number
      incomeFact: number | null
      expensePlan: number
      expenseFact: number | null
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
      expensePlan: 0,
      expenseFact: null,
    }

    if (item.metric_group === 'income') {
      row.incomePlan = item.plan_amount
      row.incomeFact = item.has_actual && item.fact_amount !== 0 ? item.fact_amount : null
    } else {
      row.expensePlan = item.plan_amount
      row.expenseFact = item.has_actual && item.fact_amount !== 0 ? item.fact_amount : null
    }

    map.set(periodValue, row)
  })

  return Array.from(map.values())
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
