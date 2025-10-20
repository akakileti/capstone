# Backend (Flask)

Flask API configured with CORS, Pydantic validation, and a placeholder accumulation calculation.

## Setup

1. Create a virtual environment and activate it.
2. Install dependencies:

   ```bash
   cd backend
   pip install -r requirements-dev.txt
   ```

## Run the API

```bash
flask --app backend.main:app --debug run
# or python -m backend.main
```

The server listens on `http://localhost:5000` with routes under `/api`.

## Tests

```bash
pytest
```

## Project layout

- `app/` – Flask app factory, routes, and error handling.
- `schemas/` – Pydantic models mirroring the frontend Zod schemas.
- `core/` – Pure functions containing the calculation logic (no Flask imports).
- `tests/` – Pytest suite for endpoints and future unit tests.
