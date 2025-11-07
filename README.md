# capstone project (added generated readme)

full-stack scaffold for the detailed compound interest calculator.

- `frontend/` – react + vite + typescript + tailwind + recharts ui that streams every plan change to the backend and renders the returned scenarios.
- `backend/` – flask + pydantic v2 service that validates plans, runs the accumulation engine, and answers `/api/calc/accumulation`.

## backend quickstart

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   #windows:.venv\Scripts\activate
pip install -U pip -r requirements.txt
flask --app app run --port 5000 --debug
```

run tests with `pytest` inside `backend/`.

## frontend quickstart

```bash
cd frontend
npm install
npm run dev
```

the dev server runs on `http://localhost:5173` and automatically calls the flask api at `http://localhost:5000/api` for every change.
