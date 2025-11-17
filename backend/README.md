# capstone backend

Flask service for running the projection engine that drives the React UI.

- `app.py` – Flask entrypoint exposing `/api/projection`, response shaping, and CORS.
- `core/projection.py` – Growth/plan models plus `project_savings_with_retirement`.
- `tests/test_projection_api.py` – Regression coverage for the projection endpoint.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # windows: .venv\Scripts\activate
pip install -U pip -r requirements.txt
flask --app app run --port 5000 --debug
```

Run tests with `pytest` from the `backend/` directory.

## API: `POST /api/projection`

Request body:

```jsonc
{
  "basicInfo": {
    "currentAge": 32,
    "retirementAge": 65,
    "currentSavings": 85000,
    "retirementSpendingRaw": 45000
  },
  "growthAssumptions": {
    "annualInflation": 0.03,
    "inflationErrorMargin": 0.01,
    "investmentReturnRate": 0.06,
    "investmentReturnErrorMargin": 0.01
  },
  "savingsPlan": {
    "breakpoints": [
      { "fromAge": 32, "base": 12000, "changeYoY": 0.02 }
    ]
  },
  "yearsAfterRetirement": 25,
  "spendingChangeYoY": 0.0
}
```

Response:

```json
[
  {
    "age": 32,
    "year": 2024,
    "contribution": 12000,
    "growth": { "min": 0.05, "avg": 0.06, "max": 0.07 },
    "spending": { "min": 0, "avg": 0, "max": 0 },
    "savings": { "min": 102300, "avg": 103200, "max": 104200 }
  },
  …
]
```

Every row matches the keys consumed by the frontend table/cards: `age`, `year`, `contribution`, and `{growth|spending|savings}.{min|avg|max}`.
