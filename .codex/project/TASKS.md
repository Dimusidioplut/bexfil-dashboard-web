# Task Tracker

## Current Focus
- Active milestone: M1 Historical data ingestion and screen
- Current task: normalize new Excel files and wire a dedicated `Прошлое` screen
- Current blocker: none

## Milestones

### M1. Historical Source Support
| ID | Status | Outcome | Verification | Depends On | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1.1 | done | Inspect new Excel files and current dashboard data flow | direct workbook inspection | - | Three source files inspected on 2026-04-21 |
| T1.2 | done | Add autonomous run docs and implementation plan on disk | repo inspection | T1.1 | `.codex/project/PRD.md`, `TASKS.md`, `WORKLOG.md` created |
| T1.3 | done | Normalize April 2026 weekly plan/fact and 2025 ERP monthly facts into JSON | `npm run sync-data` | T1.1 | Passed on 2026-04-21, payload includes `historicalWeeklyPlanFact`, `erpCashflowMonthly`, `erpPnlMonthly` |
| T1.4 | done | Add `Прошлое` screen to UI with compact charts and tables | `npm run build` + local static smoke | T1.3 | Passed on 2026-04-21, app builds with new screen |
| T1.5 | done | Refresh project docs to reflect new historical sources | doc review | T1.4 | `AGENT_CONTEXT.md`, `PROJECT_SPEC.md`, `DATA_ARCHITECTURE.md` updated |
| T1.6 | done | Verify, commit, and push checkpoint | `npm run sync-data` + `npm run lint` + `npm run build` | T1.5 | Checkpoint prepared on 2026-04-21 with updated data payload, verified app build, and pushed git state |

## Parking Lot
- Add range filters specifically for ERP historical months if the screen becomes crowded
- Decide whether `ВП 7` should later be replaced by another P&L metric
- Add visual delta highlighting and explicit tooltip delta values for past-period plan/fact

## Blockers
- None
