# Work Log

## 2026-04-21 16:20
- Goal: bootstrap a restartable loop for adding historical finance data into the dashboard
- Actions:
  - inspected current repo layout and existing dashboard screens
  - inspected `ДДС Апрель 2026 (-).xlsx`
  - inspected `ДДС ЕРП (2025для отправки).xlsx`
  - inspected `ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx`
  - identified that April 2026 file contains real weekly plan/fact while the ERP files are monthly fact-only
- Verification:
  - workbook sheets, headers, and source rows confirmed locally via Python/openpyxl
- Decisions:
  - keep historical data on a separate `Прошлое` screen
  - normalize optional source files without making them mandatory for the build
- Next:
  - extend the data builder with historical sources
  - add the new screen and verify the build

## 2026-04-21 18:55
- Goal: ship historical source support into the dashboard
- Actions:
  - extended `scripts/build_dashboard_data.py` to resolve three optional historical Excel files
  - normalized April 2026 weekly `план/факт`
  - normalized `ДДС ERP 2025` monthly facts
  - normalized `ОПУ ERP 2025` monthly facts
  - added a new `Прошлое` screen with historical charts and tables
  - refreshed project docs and agent context
- Verification:
  - `npm run sync-data`
  - `npm run lint`
  - `npm run build`
- Decisions:
  - keep ERP sections fact-only
  - keep April 2026 as a separate past-period `план/факт` block
- Next:
  - checkpoint completed and published to the main branch

## 2026-04-22 00:10
- Goal: make past-period plan/fact easier to read
- Actions:
  - added delta highlighting on fact bars for the `Прошлое` weekly plan/fact chart
  - added tooltip lines with explicit signed delta values
  - added delta columns to the April 2026 historical weekly table
- Verification:
  - `npm run lint`
  - `npm run build`
- Decisions:
  - keep only five past weekly periods because the source file itself has five weekly buckets for April 2026
- Next:
  - deploy the updated build to `beta.bigcom.ru/bexfil_dashboard/`
