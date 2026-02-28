# Frontend (React + TypeScript + Vite + Tailwind)

Client UI for the retirement projection tool. Calls the Flask backend for projections and renders min/avg/max scenarios with Recharts.

## Prerequisites
- Node 18+ (recommended)

## Setup & dev
```bash
cd frontend
npm install
npm run dev    # starts Vite on http://localhost:5173
```

## Build
```bash
npm run build
```

## Environment
- `VITE_API_BASE_URL` — API endpoint for the Flask service, e.g. `VITE_API_BASE_URL=http://localhost:5000`

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview build locally
- `npm run lint` — eslint checks
