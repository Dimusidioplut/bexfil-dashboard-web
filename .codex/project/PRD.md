# Product Requirements Document

## Snapshot
- Date: 2026-04-21
- Status: implemented
- Source brief: add historical source files into the dashboard, normalize them, and show a separate past-period screen with plan/fact and historical charts

## Problem
- The dashboard currently shows only the forward-looking weekly and monthly plan from `Данные для ДДС.xlsx`.
- New historical Excel files contain past-period cashflow and ERP facts, but the dashboard does not expose them.
- Without a dedicated historical screen, past-period analysis gets mixed with current planning.

## Users And Jobs
- Primary user: owner / operator reviewing finance status from phone and desktop
- Core job to be done: compare plan vs fact for the past period and review historical monthly ERP numbers without touching raw Excel files
- Secondary constraints: keep the UI compact, mobile-readable, and honest about source boundaries

## Scope
### In Scope
- Normalize three new Excel sources into dashboard JSON
- Add a dedicated `Прошлое` screen
- Show April 2026 weekly plan/fact from `ДДС Апрель 2026 (-).xlsx`
- Show 2025 monthly ERP cashflow from `ДДС ЕРП (2025для отправки).xlsx`
- Show 2025 monthly ERP P&L highlights from `ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx`

### Out Of Scope
- Replacing the existing weekly/monthly screens
- Writing a large PRD system for the whole business
- Backfilling server-side databases or production ETL
- Inventing plan data where the files only contain facts

## Core Flows
1. User opens `Прошлое` and sees April 2026 weekly plan/fact.
2. User reviews historical 2025 ERP monthly cashflow.
3. User reviews historical 2025 ERP P&L highlights on the same screen.

## Acceptance Criteria
- [x] `npm run sync-data` includes the three new Excel files when they are present locally
- [x] the dashboard has a separate `Прошлое` screen
- [x] April 2026 plan/fact chart shows weekly plan and fact for income and expenses
- [x] 2025 ERP cashflow is shown as a monthly historical section
- [x] 2025 ERP P&L is shown as a monthly historical section
- [x] existing `По неделям` and `По месяцам` screens still work

## Technical Plan And Constraints
- Stack: `React + Vite + TypeScript`, Python data builder
- Key implementation decisions:
  - keep raw Excel files immutable
  - resolve optional historical files from known local locations
  - serialize normalized historical records into `public/data/dashboard-data.json`
  - keep the new UI as a third screen rather than overloading existing screens
- Integration constraints:
  - files may exist outside `data_bexfil`
  - the build must not fail if those optional files are absent

## Open Questions And Assumptions
- Assumption: April 2026 `Поступления` and `Списания (операционная деятельность)` are the correct weekly plan/fact rows for the past-period chart.
- Assumption: ERP cashflow and ERP P&L are fact-only sections, not plan/fact.
- Assumption: `Валовая прибыль 7 (ВП 7)` is acceptable as an honest source row label for the P&L highlight chart.

## Verification Plan
- Tests: `npm run sync-data`, `npm run lint`, `npm run build`
- Manual checks: inspect generated JSON keys and load the new screen locally
- Release/demo checks: verify mobile-safe layout and that optional file absence still keeps the app usable
