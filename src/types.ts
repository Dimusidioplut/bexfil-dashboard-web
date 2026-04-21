export type ScreenKey = 'operational' | 'plan-fact' | 'historical'

export type MetricGroup = 'income' | 'expense'

export interface MonthlyComparisonRecord {
  period_month: string
  metric_group: MetricGroup
  summary_line: string
  plan_amount: number
  fact_amount: number
  has_actual: boolean
  delta_amount: number
  adverse_amount: number
  favorable_amount: number
}

export interface WeeklySummaryRecord {
  week_date: string
  metric_group: MetricGroup
  line_name: string
  plan_amount: number
  fact_amount: number
  has_actual: boolean
  delta_amount: number
}

export interface WeeklyPlanLineRecord {
  week_date: string
  metric_group: MetricGroup
  line_name: string
  plan_amount: number
}

export interface HistoricalWeeklyPlanFactRecord {
  week_date: string
  metric_group: MetricGroup
  line_name: string
  plan_amount: number
  fact_amount: number
  has_actual: boolean
  delta_amount: number
}

export interface ErpCashflowMonthlyRecord {
  period_month: string
  operating_amount: number
  financial_amount: number
  investment_amount: number
  transfer_amount: number
  net_amount: number
}

export interface ErpPnlMonthlyRecord {
  period_month: string
  revenue_amount: number
  vp7_amount: number
}

export interface FinanceActualRecord {
  period_type: string
  period_start: string
  metric_group: MetricGroup
  line_name: string
  fact_amount: number
  source_name: string
  comment: string
}

export interface LostContractRecord {
  lost_contract_id: string
  lost_date: string
  customer_name: string
  customer_inn: string
  contract_name: string
  amount_estimate: number
  source_type: string
  source_ref: string
  lost_reason: string
  lost_reason_group: string
  owner: string
  notes: string
  period_month?: string
}

export interface OpportunityRecord {
  opportunity_id: string
  event_date: string
  customer_name: string
  customer_inn: string
  title: string
  expected_revenue: number
  probability: number
  status: string
  source_type: string
  source_ref: string
  next_step: string
  owner: string
  notes: string
}

export interface ProductionRecord {
  snapshot_date: string
  contract_name: string
  customer_name: string
  planned_ship_date: string
  readiness_pct: number
  cogs_plan: number
  cogs_fact: number
  production_status: string
  revenue_recognition_ready: string
  notes: string
}

export interface CountRecord {
  status: string
  count: number
}

export interface DashboardData {
  generated_at: string
  source_dir: string
  source_flags: {
    monthly_plan_loaded: boolean
    weekly_plan_loaded: boolean
    finance_actuals_loaded: boolean
    lost_contracts_loaded: boolean
    opportunities_loaded: boolean
    production_loaded: boolean
    april_plan_fact_loaded: boolean
    erp_cashflow_loaded: boolean
    erp_pnl_loaded: boolean
  }
  availability: {
    monthly_range: string[]
    weekly_range: string[]
    facts_loaded: boolean
    losses_loaded: boolean
    opportunities_loaded: boolean
    historical_april_loaded: boolean
    historical_erp_loaded: boolean
  }
  monthlyComparison: MonthlyComparisonRecord[]
  weeklySummary: WeeklySummaryRecord[]
  weeklyPlanLines: WeeklyPlanLineRecord[]
  historicalWeeklyPlanFact: HistoricalWeeklyPlanFactRecord[]
  erpCashflowMonthly: ErpCashflowMonthlyRecord[]
  erpPnlMonthly: ErpPnlMonthlyRecord[]
  financeActuals: FinanceActualRecord[]
  lostContracts: LostContractRecord[]
  lostContractsMonthly: Array<{
    period_month: string
    lost_count: number
    amount_estimate: number
  }>
  opportunities: OpportunityRecord[]
  opportunitiesSummary: {
    status_counts: CountRecord[]
    expected_revenue_total: number
  }
  productionStatus: ProductionRecord[]
  productionSummary: {
    ready_count: number
    not_ready_count: number
    avg_readiness_pct: number
  }
}
