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
import "./ChartPanel.css";

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
    <section className="card chart-panel">
      <header className="chart-panel__header">
        <div>
          <h2>Your Savings Journey</h2>
          <p>Compare min / average / max projections. Toggle between nominal dollars and today&apos;s value.</p>
        </div>
        <Toggle mode={mode} onChange={setMode} disabled={!hasData || loading} />
      </header>

      <div className="chart-panel__body">
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
          <div className="chart-panel__loading">calculating…</div>
        )}
      </div>

      {error ? <p className="chart-panel__error">{error}</p> : null}
      {!error && warnings.length > 0 ? (
        <div className="chart-panel__warnings">
          <p>warnings</p>
          <ul>
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
    <div className="chart-toggle">
      <button
        type="button"
        className={mode === "nominal" ? "active" : ""}
        onClick={() => onChange("nominal")}
        disabled={disabled}
      >
        Nominal $
      </button>
      <button
        type="button"
        className={mode === "real" ? "active" : ""}
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
    <div className="chart-panel__empty">
      <p>No projection yet.</p>
      <p>Adjust the inputs on the left to generate a projection.</p>
    </div>
  );
}
