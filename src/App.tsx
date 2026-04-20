import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import type {
  DashboardData,
  LostContractRecord,
  MetricGroup,
  MonthlyComparisonRecord,
  OpportunityRecord,
  ScreenKey,
  WeeklyPlanLineRecord,
  WeeklySummaryRecord,
} from './types'
import {
  clampRange,
  formatCompact,
  formatIsoDate,
  formatMonthLabel,
  formatNumber,
  formatWeekLabel,
} from './utils'

const SCREEN_OPTIONS: Array<{ key: ScreenKey; label: string }> = [
  { key: 'operational', label: 'Оперативка' },
  { key: 'plan-fact', label: 'План / факт' },
  { key: 'losses', label: 'Потери и возможности' },
]

const COLOR_PLAN = '#2563eb'
const COLOR_FACT = '#16a34a'
const COLOR_EXPENSE = '#ea580c'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<ScreenKey>('operational')
  const [monthStart, setMonthStart] = useState(0)
  const [monthEnd, setMonthEnd] = useState(0)
  const [weekStart, setWeekStart] = useState(0)
  const [weekEnd, setWeekEnd] = useState(0)

  useEffect(() => {
    let active = true

    fetch('/data/dashboard-data.json')
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
        setMonthStart(0)
        setMonthEnd(Math.max(0, monthOptions.length - 1))
        setWeekStart(Math.max(0, weekOptions.length - 8))
        setWeekEnd(Math.max(0, weekOptions.length - 1))
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
  const visibleMonths = clampRange(monthOptions, monthStart, monthEnd)
  const visibleWeeks = clampRange(weekOptions, weekStart, weekEnd)

  const filteredMonthly = data.monthlyComparison.filter((item) =>
    visibleMonths.includes(item.period_month),
  )
  const filteredWeekly = data.weeklySummary.filter((item) =>
    visibleWeeks.includes(item.week_date),
  )
  const filteredWeekLines = data.weeklyPlanLines.filter((item) =>
    visibleWeeks.includes(item.week_date),
  )
  const filteredLostContracts = data.lostContracts.filter((item) =>
    item.period_month ? visibleMonths.includes(item.period_month) : true,
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

        <div className="sync-meta">
          <span>{formatIsoDate(data.generated_at)}</span>
          <StatusBadge
            tone={data.source_flags.finance_actuals_loaded ? 'good' : 'neutral'}
            label={data.source_flags.finance_actuals_loaded ? 'Факт загружен' : 'Пока только план'}
          />
        </div>
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
          lostContracts={filteredLostContracts}
          lostMonthly={data.lostContractsMonthly.filter((item) =>
            visibleMonths.includes(item.period_month),
          )}
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

      {screen === 'losses' ? (
        <LossesScreen
          opportunities={data.opportunities}
          lostContracts={data.lostContracts}
          productionReady={data.productionSummary}
        />
      ) : null}
    </main>
  )
}

function OperationalScreen(props: {
  items: WeeklySummaryRecord[]
  weekLines: WeeklyPlanLineRecord[]
  weekOptions: string[]
  weekStart: number
  weekEnd: number
  onWeekStartChange: (value: string) => void
  onWeekEndChange: (value: string) => void
}) {
  const incomeItems = props.items.filter((item) => item.metric_group === 'income')
  const expenseItems = props.items.filter((item) => item.metric_group === 'expense')
  const incomeTotals = summarizeMetrics(incomeItems)
  const expenseTotals = summarizeMetrics(expenseItems)

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

      <div className="summary-strip">
        <MetricTile label="План доходов" value={incomeTotals.plan} tone="plan" />
        <MetricTile label="Факт доходов" value={incomeTotals.fact} tone="fact" muted={!incomeTotals.hasActual} />
        <MetricTile label="План расходов" value={expenseTotals.plan} tone="expense" />
        <MetricTile label="Факт расходов" value={expenseTotals.fact} tone="fact" muted={!expenseTotals.hasActual} />
      </div>

      <div className="chart-grid">
        <ChartPanel
          eyebrow="Доходы"
          status={buildStatus('income', incomeTotals.delta, incomeTotals.hasActual)}
        >
          <MetricChart items={incomeItems} kind="income" dateFormatter={formatWeekLabel} dateKey="week_date" />
        </ChartPanel>
        <ChartPanel
          eyebrow="Расходы"
          status={buildStatus('expense', expenseTotals.delta, expenseTotals.hasActual)}
        >
          <MetricChart items={expenseItems} kind="expense" dateFormatter={formatWeekLabel} dateKey="week_date" />
        </ChartPanel>
      </div>

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
                <th>Факт доходов</th>
                <th>План расходов</th>
                <th>Факт расходов</th>
              </tr>
            </thead>
            <tbody>
              {buildWeeklyTableRows(props.items).map((row) => (
                <tr key={row.week}>
                  <td>{formatWeekLabel(row.week)}</td>
                  <td>{formatNumber(row.incomePlan)}</td>
                  <td>{row.incomeFact === null ? 'нет' : formatNumber(row.incomeFact)}</td>
                  <td>{formatNumber(row.expensePlan)}</td>
                  <td>{row.expenseFact === null ? 'нет' : formatNumber(row.expenseFact)}</td>
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
                    <td>{formatWeekLabel(line.week_date)}</td>
                    <td>{line.metric_group === 'income' ? 'Доход' : 'Расход'}</td>
                    <td>{line.line_name}</td>
                    <td>{formatNumber(line.plan_amount)}</td>
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
  lostContracts: LostContractRecord[]
  lostMonthly: Array<{ period_month: string; lost_count: number; amount_estimate: number }>
  monthOptions: string[]
  monthStart: number
  monthEnd: number
  onMonthStartChange: (value: string) => void
  onMonthEndChange: (value: string) => void
}) {
  const incomeItems = props.items.filter((item) => item.metric_group === 'income')
  const expenseItems = props.items.filter((item) => item.metric_group === 'expense')
  const incomeTotals = summarizeMetrics(incomeItems)
  const expenseTotals = summarizeMetrics(expenseItems)
  const lostTotal = props.lostContracts.length

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

      <div className="summary-strip">
        <MetricTile label="Доходы план" value={incomeTotals.plan} tone="plan" />
        <MetricTile label="Доходы факт" value={incomeTotals.fact} tone="fact" muted={!incomeTotals.hasActual} />
        <MetricTile label="Расходы план" value={expenseTotals.plan} tone="expense" />
        <MetricTile label="Упущенные договоры" value={lostTotal} tone="neutral" compact />
      </div>

      <div className="chart-grid">
        <ChartPanel
          eyebrow="Доходы"
          status={buildStatus('income', incomeTotals.delta, incomeTotals.hasActual)}
        >
          <MetricChart items={incomeItems} kind="income" dateFormatter={formatMonthLabel} dateKey="period_month" />
        </ChartPanel>
        <ChartPanel
          eyebrow="Расходы"
          status={buildStatus('expense', expenseTotals.delta, expenseTotals.hasActual)}
        >
          <MetricChart items={expenseItems} kind="expense" dateFormatter={formatMonthLabel} dateKey="period_month" />
        </ChartPanel>
      </div>

      <section className="table-panel">
        <div className="panel-head">
          <span className="eyebrow">Упущенные договоры</span>
          {!props.lostContracts.length ? (
            <StatusBadge tone="neutral" label="Подтвержденных данных пока нет" />
          ) : null}
        </div>
        {props.lostContracts.length ? (
          <div className="chart-short">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={props.lostMonthly.map((item) => ({
                label: formatMonthLabel(item.period_month),
                count: item.lost_count,
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[8, 8, 0, 0]} name="Договоры" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="Заполните lost_contracts.csv, чтобы появилась аналитика по потерям." />
        )}
      </section>
    </section>
  )
}

function LossesScreen(props: {
  opportunities: OpportunityRecord[]
  lostContracts: LostContractRecord[]
  productionReady: {
    ready_count: number
    not_ready_count: number
    avg_readiness_pct: number
  }
}) {
  const hasLosses = props.lostContracts.length > 0
  const hasOpportunities = props.opportunities.length > 0

  return (
    <section className="screen-grid">
      <div className="summary-strip">
        <MetricTile
          label="Возможности"
          value={props.opportunities.length}
          tone="neutral"
          compact
          muted={!hasOpportunities}
        />
        <MetricTile
          label="Упущенные договоры"
          value={props.lostContracts.length}
          tone="neutral"
          compact
          muted={!hasLosses}
        />
        <MetricTile
          label="Готово к выручке"
          value={props.productionReady.ready_count}
          tone="good"
          compact
          muted={props.productionReady.ready_count === 0}
        />
        <MetricTile
          label="Средняя готовность"
          value={`${Math.round(props.productionReady.avg_readiness_pct)}%`}
          tone="neutral"
          muted={props.productionReady.avg_readiness_pct === 0}
        />
      </div>

      {!hasLosses && !hasOpportunities ? (
        <section className="table-panel">
          <EmptyState text="Этот экран включается только после загрузки подтвержденных данных по возможностям и потерям." />
        </section>
      ) : null}

      {hasOpportunities ? (
        <section className="table-panel">
          <div className="panel-head">
            <span className="eyebrow">Возможности</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Сделка</th>
                  <th>Статус</th>
                  <th>Ожидаемо</th>
                </tr>
              </thead>
              <tbody>
                {props.opportunities.map((item) => (
                  <tr key={item.opportunity_id || `${item.event_date}-${item.title}`}>
                    <td>{formatIsoDate(item.event_date)}</td>
                    <td>{item.customer_name || '—'}</td>
                    <td>{item.title || '—'}</td>
                    <td>{item.status || '—'}</td>
                    <td>{formatNumber(item.expected_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {hasLosses ? (
        <section className="table-panel">
          <div className="panel-head">
            <span className="eyebrow">Потери</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Договор</th>
                  <th>Причина</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {props.lostContracts.map((item) => (
                  <tr key={item.lost_contract_id || `${item.lost_date}-${item.contract_name}`}>
                    <td>{formatIsoDate(item.lost_date)}</td>
                    <td>{item.customer_name || '—'}</td>
                    <td>{item.contract_name || '—'}</td>
                    <td>{item.lost_reason_group || item.lost_reason || '—'}</td>
                    <td>{formatNumber(item.amount_estimate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}

function MetricChart(props: {
  items: Array<WeeklySummaryRecord | MonthlyComparisonRecord>
  kind: MetricGroup
  dateKey: 'week_date' | 'period_month'
  dateFormatter: (value: string) => string
}) {
  const rows = props.items.map((item) => ({
    label: props.dateFormatter(
      props.dateKey === 'week_date'
        ? (item as WeeklySummaryRecord).week_date
        : (item as MonthlyComparisonRecord).period_month,
    ),
    plan: item.plan_amount,
    fact: item.has_actual ? item.fact_amount : null,
    delta: item.has_actual ? item.delta_amount : null,
    bad:
      props.kind === 'expense'
        ? item.has_actual && item.fact_amount > item.plan_amount
        : item.has_actual && item.fact_amount < item.plan_amount,
  }))

  return (
    <div className="chart-short">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} barGap={10}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<MetricTooltip metric={props.kind} />} />
          <Legend />
          <Bar dataKey="plan" fill={props.kind === 'expense' ? COLOR_EXPENSE : COLOR_PLAN} radius={[8, 8, 0, 0]} name="План" />
          <Bar dataKey="fact" fill={COLOR_FACT} radius={[8, 8, 0, 0]} name="Факт" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function MetricTooltip(props: {
  active?: boolean
  payload?: Array<{
    payload: {
      label: string
      plan: number
      fact: number | null
      delta: number | null
      bad: boolean
    }
  }>
  metric: MetricGroup
}) {
  if (!props.active || !props.payload?.length) {
    return null
  }

  const row = props.payload[0].payload
  const statusTone = row.delta === null ? 'neutral' : row.bad ? 'bad' : 'good'
  const statusText =
    row.delta === null
      ? 'Факт не загружен'
      : row.bad
        ? 'Неблагоприятное отклонение'
        : 'Благоприятное отклонение'

  return (
    <div className="tooltip">
      <div className="tooltip-title">{row.label}</div>
      <div className="tooltip-line">
        <span>План</span>
        <strong>{formatNumber(row.plan)}</strong>
      </div>
      <div className="tooltip-line">
        <span>Факт</span>
        <strong>{row.fact === null ? 'нет' : formatNumber(row.fact)}</strong>
      </div>
      <div className="tooltip-line">
        <span>Разница</span>
        <strong>{row.delta === null ? 'нет' : formatNumber(Math.abs(row.delta))}</strong>
      </div>
      <StatusBadge
        tone={statusTone}
        label={
          props.metric === 'expense' && row.delta !== null
            ? row.bad
              ? 'Расход выше плана'
              : 'Расход в пределах плана'
            : props.metric === 'income' && row.delta !== null
              ? row.bad
                ? 'Доход ниже плана'
                : 'Доход выше плана'
              : statusText
        }
      />
    </div>
  )
}

function ChartPanel(props: {
  eyebrow: string
  status: { label: string; tone: 'good' | 'bad' | 'neutral' }
  children: ReactNode
}) {
  return (
    <section className="chart-panel">
      <div className="panel-head">
        <span className="eyebrow">{props.eyebrow}</span>
        <StatusBadge tone={props.status.tone} label={props.status.label} />
      </div>
      {props.children}
    </section>
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

function EmptyState(props: { text: string }) {
  return <div className="empty-state">{props.text}</div>
}

function summarizeMetrics(items: Array<WeeklySummaryRecord | MonthlyComparisonRecord>) {
  const hasActual = items.some((item) => item.has_actual)
  const plan = items.reduce((sum, item) => sum + item.plan_amount, 0)
  const fact = hasActual
    ? items.reduce((sum, item) => sum + (item.has_actual ? item.fact_amount : 0), 0)
    : 0
  const delta = hasActual ? fact - plan : 0
  return { plan, fact, delta, hasActual }
}

function buildWeeklyTableRows(items: WeeklySummaryRecord[]) {
  const map = new Map<
    string,
    { week: string; incomePlan: number; incomeFact: number | null; expensePlan: number; expenseFact: number | null }
  >()

  items.forEach((item) => {
    const existing = map.get(item.week_date) ?? {
      week: item.week_date,
      incomePlan: 0,
      incomeFact: null,
      expensePlan: 0,
      expenseFact: null,
    }
    if (item.metric_group === 'income') {
      existing.incomePlan = item.plan_amount
      existing.incomeFact = item.has_actual ? item.fact_amount : null
    } else {
      existing.expensePlan = item.plan_amount
      existing.expenseFact = item.has_actual ? item.fact_amount : null
    }
    map.set(item.week_date, existing)
  })

  return Array.from(map.values())
}

function buildStatus(metric: MetricGroup, delta: number, hasActual: boolean) {
  if (!hasActual) {
    return { label: 'Факт не загружен', tone: 'neutral' as const }
  }
  if (metric === 'expense') {
    return delta > 0
      ? { label: 'Выше плана', tone: 'bad' as const }
      : { label: 'В пределах плана', tone: 'good' as const }
  }
  return delta < 0
    ? { label: 'Ниже плана', tone: 'bad' as const }
    : { label: 'Выше плана', tone: 'good' as const }
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

export default App
