# Agent Context

## Что это

Пересобранный Streamlit-дашборд для Bexfil, который честно разделяет:
- финансовый план;
- ручной финансовый факт;
- тендерный рынок;
- справочник компаний;
- ручной pipeline / потери / производство.

## Где запуск

- стартовый файл: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard/dashboard_app.py`
- код: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard/src/bexfil_dashboard`
- основная спецификация: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard/docs/PROJECT_SPEC.md`
- архитектура данных: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard/docs/DATA_ARCHITECTURE.md`
- краткий рабочий бриф: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard/docs/AGENT_BRIEF.md`

## Что реально подключено сейчас

- `Данные для ДДС.xlsx`
  - месячный план `апрель-июнь 2026`
  - недельный план `16.04.2026 - 25.06.2026`
- `Контур.Закупки_20.04.2026*.xlsx`
  - история тендеров `2022-2025`
- `Бэкс - 06.02.2026 база на согласование.xlsx`
  - база компаний

## Что еще нужно загрузить вручную

- `dashboard/data_workspace/manual/finance_actuals.csv`
- `dashboard/data_workspace/manual/opportunities.csv`
- `dashboard/data_workspace/manual/lost_contracts.csv`
- `dashboard/data_workspace/manual/production_status.csv`

## Важные ограничения

- исходные файлы в `/Users/vasa/Documents/projects work/big company/bexfil/data_bexfil` не менять;
- в raw-источниках нет полноценного финансового факта за всю историю;
- в raw-источниках нет подтвержденных `lost_contracts`;
- тендерный экран показывает рынок, а не автоматически определенные потери.

## Что уже сделано

- обновлена спецификация проекта;
- обновлена архитектура данных;
- добавлены шаблоны ручных таблиц;
- полностью переписан слой данных;
- полностью переписан Streamlit UI;
- добавлены отдельные экраны: `Главная`, `Финансы`, `Тендеры`, `Компании`, `Pipeline`.

## Что делать следующим агентом

1. Подключить реальный `finance_actuals.csv` или внешний источник факта.
2. Заполнить `opportunities.csv` и `lost_contracts.csv`.
3. При необходимости вынести нормализованный слой в PostgreSQL.
4. После появления production-данных подключить блок готовности к отгрузке и себестоимости.
