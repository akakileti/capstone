import { useMemo, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, type ProjectionCase } from "../lib/calc";

interface ChartPanelProps {
  cases: ProjectionCase[];
  warnings?: string[];
  loading?: boolean;
  error?: string | null;
}

type DisplayMode = "nominal" | "real";

export function ChartPanel({ cases, warnings = [], loading = false, error }: ChartPanelProps) {
  const [mode, setMode] = useState<DisplayMode>("nominal");

  const chartData = useMemo(() => {
    if (!cases.length) return [];

    const length = cases[0]?.points.length ?? 0;
    return Array.from({ length }, (_, index) => {
      const entry: Record<string, number | string> = {
        age: cases[0].points[index]?.age ?? index,
      };

      for (const projection of cases) {
        const point = projection.points[index];
        if (point) {
          entry[projection.id] = mode === "nominal" ? point.nominal : point.real;
        }
      }

      return entry;
    });
  }, [cases, mode]);

  const hasData = chartData.length > 0;

  return (
    <section className="relative flex min-h-[480px] max-h-[560px] flex-col rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Your Savings Journey</h2>
          <p className="text-xs text-slate-500">
            Compare min / average / max projections. Toggle between nominal dollars and today&apos;s value.
          </p>
        </div>
        <Toggle mode={mode} onChange={setMode} disabled={!hasData || loading} />
      </header>

      <div className="relative flex-1">
        {!hasData && !loading ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 12, fill: "#475569" }} />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fontSize: 12, fill: "#475569" }}
                width={100}
              />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(value as number)}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend verticalAlign="top" height={36} />
              {cases.map((projection) => (
                <Line
                  key={projection.id}
                  type="monotone"
                  dataKey={projection.id}
                  name={projection.label}
                  stroke={projection.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!loading}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/60 text-xs font-medium uppercase tracking-wide text-slate-500 backdrop-blur">
            Calculating…
          </div>
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!error && warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-semibold">warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Toggle({
  mode,
  onChange,
  disabled,
}: {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition ${
          mode === "nominal"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => onChange("nominal")}
        disabled={disabled}
      >
        Nominal $
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition ${
          mode === "real" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => onChange("real")}
        disabled={disabled}
      >
        Today&apos;s $
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
      <div>
        <p className="font-medium text-slate-600">No projection yet</p>
        <p>Adjust the inputs on the left to generate a projection.</p>
      </div>
    </div>
  );
}
