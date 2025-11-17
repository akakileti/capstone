import { type ChangeEvent, useEffect, useMemo, useState } from "react";

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
type ViewRange = { startAge: number; endAge: number };
type RangeBounds = { minAge: number; maxAge: number };

const DEFAULT_WINDOW_YEARS = 80;
const DEFAULT_VIEW_MAX_AGE = 80;

export function ChartPanel({ cases, warnings = [], loading = false, error }: ChartPanelProps) {
  const [mode, setMode] = useState<DisplayMode>("real");
  const [range, setRange] = useState<ViewRange | null>(null);

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

  const bounds = useMemo<RangeBounds | null>(() => {
    if (!cases.length) return null;
    const ages = cases.flatMap((projection) => projection.points.map((p) => p.age));
    if (!ages.length) return null;
    return {
      minAge: Math.min(...ages),
      maxAge: Math.max(...ages),
    };
  }, [cases]);

  useEffect(() => {
    if (!bounds) {
      setRange(null);
      return;
    }
    setRange((previous) => {
      const desiredEnd =
        bounds.minAge < DEFAULT_VIEW_MAX_AGE
          ? DEFAULT_VIEW_MAX_AGE
          : Math.min(bounds.minAge + DEFAULT_WINDOW_YEARS, bounds.maxAge);
      const defaultEnd = Math.min(desiredEnd, bounds.maxAge);
      if (!previous) {
        const normalizedEnd =
          defaultEnd <= bounds.minAge
            ? Math.min(bounds.maxAge, bounds.minAge + DEFAULT_WINDOW_YEARS)
            : defaultEnd;
        return {
          startAge: bounds.minAge,
          endAge: normalizedEnd,
        };
      }
      const startAge = clamp(previous.startAge, bounds.minAge, bounds.maxAge - 1);
      const endAge = clamp(previous.endAge, startAge + 1, bounds.maxAge);
      return { startAge, endAge };
    });
  }, [bounds?.minAge, bounds?.maxAge]);

  const filteredData = useMemo(() => {
    if (!chartData.length) return [];
    if (!range) return chartData;
    return chartData.filter((entry) => {
      const value = typeof entry.age === "number" ? entry.age : Number(entry.age);
      if (Number.isNaN(value)) return false;
      return value >= range.startAge && value <= range.endAge;
    });
  }, [chartData, range]);

  const hasData = filteredData.length > 0;
  const axisDomain: [number | "auto", number | "auto"] = range
    ? [range.startAge, range.endAge]
    : ["auto", "auto"];

  return (
    <section className="relative flex flex-col gap-6 rounded-3xl border border-slate-300 bg-white p-6 pb-4 text-slate-500 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Your Savings Journey</h2>
          <p className="text-xs text-slate-500">
            Compare min / average / max projections. Toggle between nominal dollars and today&apos;s value.
          </p>
        </div>
        <Toggle mode={mode} onChange={setMode} disabled={!hasData || loading} />
      </header>

      <div className="relative">
        {!hasData && !loading ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={filteredData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis
                dataKey="age"
                type="number"
                domain={axisDomain}
                tick={{ fontSize: 12, fill: "#475569" }}
              />
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

      {range && bounds ? (
        <RangeSelector
          range={range}
          bounds={bounds}
          onChange={setRange}
          disabled={loading || !hasData}
        />
      ) : null}

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

interface RangeSelectorProps {
  range: ViewRange;
  bounds: RangeBounds;
  disabled?: boolean;
  onChange: (range: ViewRange) => void;
}

function RangeSelector({ range, bounds, disabled, onChange }: RangeSelectorProps) {
  const { minAge, maxAge } = bounds;
  const span = Math.max(maxAge - minAge, 1);
  const leftPercent = ((range.startAge - minAge) / span) * 100;
  const rightPercent = 100 - ((range.endAge - minAge) / span) * 100;

  const handleStart = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    const next = clamp(value, minAge, range.endAge - 1);
    onChange({ startAge: next, endAge: range.endAge });
  };

  const handleEnd = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    const next = clamp(value, range.startAge + 1, maxAge);
    onChange({ startAge: range.startAge, endAge: next });
  };

  return (
    <div className="mt-6 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-slate-600 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span className="uppercase tracking-tight">View Window</span>
        <span className="text-slate-800">
          Ages {range.startAge} – {range.endAge}
        </span>
      </div>
      <div className="mt-3">
        <div className="relative h-9">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-slate-200" />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-900/30"
            style={{ left: `${leftPercent}%`, right: `${rightPercent}%` }}
          />
          <input
            type="range"
            min={minAge}
            max={Math.max(minAge, range.endAge - 1)}
            value={range.startAge}
            onChange={handleStart}
            disabled={disabled}
            className="range-input absolute inset-0 m-0 h-9 w-full cursor-pointer"
          />
          <input
            type="range"
            min={Math.min(range.startAge + 1, maxAge)}
            max={maxAge}
            value={range.endAge}
            onChange={handleEnd}
            disabled={disabled}
            className="range-input absolute inset-0 m-0 h-9 w-full cursor-pointer"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 text-[11px] font-medium text-slate-500">
          <span>Min {minAge}</span>
          <span>Max {maxAge}</span>
        </div>
      </div>
    </div>
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

function clamp(value: number, min: number, max: number): number {
  if (min >= max) return min;
  return Math.min(Math.max(value, min), max);
}
