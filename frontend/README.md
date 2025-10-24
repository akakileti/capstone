# Frontend (React + TypeScript + Vite + Tailwind)

Client-side UI for the detailed compound interest calculator. The app now posts every plan change to the Flask backend and renders the returned scenarios in real time.

## Available Scripts

```bash
npm install
npm run dev       # start Vite on http://localhost:5173
npm run build     # type-check and build for production
npm run preview   # preview the production build
npm run lint      # run eslint
```

## Environment

`VITE_API_BASE_URL` overrides the default API URL. Create a `.env` file in this directory if you need to change it:

## Project layout

- `src/App.tsx` – page shell that wires the form and chart together.
- `src/components/InputWizard.tsx` – multi-section control panel that syncs high-level inputs with the detailed planning schedules.
- `src/components/DetailedPlanningPanel.tsx` – summaries plus entry points for the detailed planning modals.
- `src/components/SavingsProgressionModal.tsx` / `RetirementSpendingModal.tsx` – configure multi-account contribution schedules and retirement drawdown plans.
- `src/components/ChartPanel.tsx` – Recharts visualization with min/avg/max cases and nominal/real toggle.
- `src/lib/schemas.ts` – shared Zod schema for plan inputs.
- `src/lib/calc.ts` – chart helper types, scenario styling, and formatter utilities.
- `src/lib/api.ts` – axios client that calls the Flask accumulation endpoint and maps the response into chart-ready structures.
