# Capstone Project (generated summary for now)

Semester project scaffold with a layered architecture:

- `frontend/` – React + Vite + TypeScript + Tailwind + Recharts client interface with multi-case projections and detailed planning modals.
- `backend/` – Flask API using Pydantic for validation and pytest for tests.

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
flask --app backend.main:app --debug run
```

The API serves from `http://localhost:5000/api` with a `GET /ping` health check and a placeholder `POST /calc/accumulation`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173`. Everything runs locally for now; when you are ready to call Flask, update `frontend/src/lib/api.ts`.

## Next steps

- Replace the placeholder accumulation math in `backend/core/accumulation.py` with formulas from your Excel model.
- Expand the shared schemas in `backend/schemas/` and `frontend/src/lib/schemas.ts` as you add endpoints.
- Add more React components, presets, and charts on the frontend to visualize the financial outputs once you connect the API.
