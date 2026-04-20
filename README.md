# Bexfil Dashboard Web

Быстрый web-MVP без `Streamlit`. Проект живет только в этой папке и предназначен для отдельного GitHub-репозитория без лишних файлов из корня.

## Что внутри

- `src/` — интерфейс на `React + Vite`
- `scripts/build_dashboard_data.py` — нормализация данных из Excel/CSV в JSON для фронта
- `manual-data/` — ручные CSV-шаблоны для факта, потерь, возможностей и производства
- `docs/` — зафиксированные требования и архитектура

## Источники данных

- raw-данные читаются из `../data_bexfil` по умолчанию
- путь можно переопределить через `BEXFIL_SOURCE_DIR`
- raw-данные и бизнес-документы в этот репозиторий не входят

## Что реально отображается сейчас

- `Оперативка` — недельный план по доходам и расходам из `Данные для ДДС.xlsx`
- `План / факт` — месячный план за `апрель-июнь 2026`; факт появится после заполнения `manual-data/finance_actuals.csv`
- `Потери и возможности` — включается после заполнения `manual-data/lost_contracts.csv` и `manual-data/opportunities.csv`

## Локальный запуск

```bash
cd "/Users/vasa/Documents/projects work/big company/bexfil/dashboard-web"
python3 -m venv .venv
.venv/bin/pip install -r requirements-data.txt
npm install
npm run sync-data
npm run dev
```

Локальный адрес по умолчанию:

- [http://127.0.0.1:4173](http://127.0.0.1:4173)

## Сборка

```bash
npm run build
```

Для обновления данных перед сборкой:

```bash
npm run build:refresh
```

`build` собирает уже зафиксированный JSON-снимок из `public/data/dashboard-data.json`.  
`build:refresh` сначала пересобирает этот JSON из `../data_bexfil`, а затем делает production-сборку.

## Ручные CSV

- `manual-data/finance_actuals.csv`
- `manual-data/lost_contracts.csv`
- `manual-data/opportunities.csv`
- `manual-data/production_status.csv`

Без этих файлов экран не будет выдумывать факт или потери: он честно показывает только то, что реально загружено.
