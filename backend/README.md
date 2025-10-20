# Backend Overview

| File | Purpose |
| --- | --- |
| `app.py` | Flask entrypoint exposing `/api/calc/accumulation` and wiring CORS. |
| `models.py` | Pydantic data contracts for plans, accounts, intervals, and scenarios. |
| `domain/accumulation.py` | Pure projection engine, validation helpers, and response shaping. |
| `tests/test_accumulation.py` | Pytest coverage for regression, overrides, spending, and validation. |
| `sample_plan.json` | Example payload matching the frontend defaults. |

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -U pip -r requirements.txt
flask --app app run --port 5000 --debug
```

Run tests with `pytest` from the `backend/` directory.
