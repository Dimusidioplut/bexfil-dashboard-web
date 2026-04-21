# Agent Context

## Что это

`bexfil-dashboard-web` — отдельный фронтенд-проект для тестового дашборда Bexfil.

- стек: `React + Vite + TypeScript`
- формат деплоя: статическая сборка
- текущий публичный URL: `https://beta.bigcom.ru/bexfil_dashboard/`
- исходные raw-данные читаются из `../data_bexfil` только на этапе подготовки JSON

## Где что лежит

- репозиторий: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web`
- фронт: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/src`
- сборка данных: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/scripts/build_dashboard_data.py`
- зафиксированные данные для фронта: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/public/data/dashboard-data.json`
- ручные CSV: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/manual-data`
- спецификация: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/docs/PROJECT_SPEC.md`
- архитектура данных: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/docs/DATA_ARCHITECTURE.md`
- playbook тестового сервера: `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web/docs/TEST_SERVER_PLAYBOOK.md`

## Что реально показывает UI

- `По неделям` — недельный план
- `По месяцам` — месячный план
- `Прошлое` — отдельный экран с историческими файлами

Сейчас это разные представления из разных листов одного Excel:

- недельный экран берёт данные из недельного листа
- месячный экран берёт данные из месячного листа

Расхождения между этими экранами сидят в исходном файле `Данные для ДДС.xlsx`, а не во фронте.

Дополнительно `Прошлое` собирается из:

- `ДДС Апрель 2026 (-).xlsx` — недельный `план/факт` по прошлому периоду
- `ДДС ЕРП (2025для отправки).xlsx` — месячный `ДДС ERP 2025`
- `ОПУ ЕРП (2025для отправкиРУБ) (1).xlsx` — месячные `Выручка` и `ВП 7`

`scripts/build_dashboard_data.py` ищет эти файлы:

- в `../data_bexfil`
- в `~/Downloads/Telegram Desktop`

## Текущий деплой

- домен: `beta.bigcom.ru`
- путь проекта: `/bexfil_dashboard/`
- корень домена `/` сейчас намеренно пустой и отвечает `204`
- статика проекта раздаётся `nginx` из `/var/www/beta.bigcom.ru/bexfil_dashboard`

## Правила для следующего агента

1. Не возвращать Streamlit и не смешивать этот проект со старым `dashboard/`.
2. Работать только в `/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web`.
3. Не коммитить raw-данные из `data_bexfil`.
4. При деплое на тестовый сервер обновлять только подпуть `/bexfil_dashboard/`, не ломая другие проекты.
5. Если нужен новый тестовый проект, заводить его как отдельный slug и описывать в серверном реестре.
