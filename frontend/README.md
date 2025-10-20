# Frontend (React + TypeScript + Vite + Tailwind)

Client-side projection tool that matches the onboarding checklist. Everything runs locally for now; later you can switch `src/lib/api.ts` to call the Flask backend.

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
- `src/components/InputWizard.tsx` – multi-section Zod + react-hook-form experience with presets; keeps high-level inputs in sync with the detailed planning schedules.
- `src/components/DetailedPlanningPanel.tsx` – summaries plus entry points for the detailed planning modals.
- `src/components/SavingsProgressionModal.tsx` / `RetirementSpendingModal.tsx` – configure multi-account contribution schedules and retirement drawdown plans.
- `src/components/ChartPanel.tsx` – Recharts visualization with min/avg/max cases and nominal/real toggle.
- `src/lib/schemas.ts` – shared Zod schema for plan inputs.
- `src/lib/calc.ts` – local projection math and currency formatter.
- `src/lib/api.ts` – single place to switch from local calc to the Flask API.

When you are ready to call Flask, update `runProjection` in `src/lib/api.ts` and swap the call site in `App.tsx` as described in the guide.
