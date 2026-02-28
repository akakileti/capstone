# Backend (Flask + Pydantic)

Flask service that exposes the projection engine consumed by the React frontend.

## Requirements
- Python 3.11 (tested in CI)

## Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -U pip -r requirements.txt
```

## Run locally
```bash
flask --app app run --port 5000 --debug
```

## Environment
- `CORS_ORIGINS` — optional comma-separated list of allowed origins. Defaults include common localhost ports.

## Tests
```bash
cd backend
python -m pytest -q
```

## API
`POST /api/projection` — accepts a projection request (validated by Pydantic) and returns per-year rows for min/avg/max scenarios. See root README for contract details.
