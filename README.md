# Retirement Projection Studio

Plan, compare, and project long-term retirement outcomes without linking accounts. Built for young professionals who want transparent, scenario-based projections that show how inflation, returns, and spending choices shape retirement runway.

## Live Site
- [https://capstone-alpha-blond.vercel.app/](https://capstone-alpha-blond.vercel.app/)

## Architecture at a glance
- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts (`frontend/`). Renders the calculator UI and homepage, calls the backend via REST.
- **Backend:** Flask API with Pydantic validation (`backend/`). Provides a deterministic projection engine (min/avg/max scenarios) and returns year-by-year rows.
- **Contract:** `POST /api/projection` — frontend posts the current plan, backend returns projection rows; CORS controlled via environment.

## Getting started locally
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -U pip -r requirements.txt
flask --app app run --port 5000 --debug
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # starts Vite on http://localhost:5173
```

## Environment variables
- **VITE_API_BASE_URL** (frontend): e.g. `VITE_API_BASE_URL=http://localhost:5000`
- **CORS_ORIGINS** (backend): comma-separated list to allow additional origins, e.g. `CORS_ORIGINS=https://your-frontend.vercel.app`

## Testing
Backend tests (pytest):
```bash
cd backend
python -m pytest -q
```
No automated frontend tests are present.

## Deployment notes
- Frontend: deployable to Vercel (static build via `npm run build`).
- Backend: deployable to Render (Flask service). Cold starts on Render can take ~3 minutes before the API responds.

## Limitations / assumptions
- Deterministic min/avg/max scenarios; no Monte Carlo simulation.
- Flat tax rates per account; no bracketed or progressive tax modeling.
- Withdrawals are effectively pooled across accounts (no priority order).
- Spending targets are modeled as after-tax consumption; gross-up rules are simplified.

## Roadmap (future work)
- Broaden automated tests (more API edge cases, multi-account scenarios).
- Add additional visualizations and benchmarks on the homepage.
- Allow saving/sharing input sets per user/session.
