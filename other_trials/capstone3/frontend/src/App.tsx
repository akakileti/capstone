import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:6065/api";

type BasicInfo = {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  retirementSpendingRaw: number;
};

type ScenarioValues = {
  min: number;
  avg: number;
  max: number;
};

type GrowthAssumptions = {
  annualInflation: number;
  inflationErrorMargin: number;
  investmentReturnRate: number;
  investmentReturnErrorMargin: number;
};

type ContributionBreakpoint = {
  fromAge: number;
  base: number;
  changeYoY: number;
  years?: number | null;
};

type SavingsPlan = {
  breakpoints: ContributionBreakpoint[];
};

type YearRow = {
  age: number;
  year: number;
  contribution: number;
  growth: ScenarioValues;
  savings: ScenarioValues;
};

type ProjectionResponse = {
  rows: YearRow[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const InputField = ({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) => (
  <div className="field">
    <label>{label}</label>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="panel" style={{ padding: "12px 16px" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Age {label}</div>
      {payload.map((item: any) => (
        <div key={item.dataKey} style={{ fontSize: "0.85rem", color: "#475569" }}>
          {item.name}: {currency.format(item.value)}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [basic, setBasic] = useState<BasicInfo | null>(null);
  const [assumptions, setAssumptions] = useState<GrowthAssumptions | null>(null);
  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<YearRow[]>([]);
  const [valueMode, setValueMode] = useState<"nominal" | "real">("nominal");
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDefaults = async () => {
      try {
        setIsLoadingDefaults(true);
        const response = await fetch(`${API_BASE}/defaults`);
        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        setBasic(payload.basic);
        setAssumptions(payload.assumptions);
        setPlan(payload.plan);
        setCurrentYear(payload.currentYear ?? new Date().getFullYear());
      } catch (err) {
        console.error(err);
        setError("unable to load defaults from the api");
      } finally {
        if (isMounted) {
          setIsLoadingDefaults(false);
        }
      }
    };
    loadDefaults();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!basic || !assumptions || !plan) {
      return;
    }
    setError(null);
    setIsLoadingProjection(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ basic, assumptions, plan, currentYear }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("api error");
        }
        const payload: ProjectionResponse = await response.json();
        setRows(payload.rows);
      } catch (err) {
        if ((err as DOMException).name !== "AbortError") {
          console.error(err);
          setError("unable to refresh projections");
        }
      } finally {
        setIsLoadingProjection(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [basic, assumptions, plan, currentYear]);

  const chartData = useMemo(() => {
    if (!assumptions) {
      return [];
    }
    return rows.map((row) => {
      const yearsFromNow = row.age - (basic?.currentAge ?? row.age);
      const inflation = assumptions.annualInflation;
      const discount = valueMode === "real" ? (1 + inflation) ** yearsFromNow : 1;
      return {
        age: row.age,
        min: row.savings.min / discount,
        avg: row.savings.avg / discount,
        max: row.savings.max / discount,
      };
    });
  }, [rows, assumptions, basic, valueMode]);

  const totals = useMemo(() => {
    if (!rows.length) {
      return null;
    }
    const last = rows[rows.length - 1];
    return {
      min: currency.format(last.savings.min),
      avg: currency.format(last.savings.avg),
      max: currency.format(last.savings.max),
    };
  }, [rows]);

  const onBasicChange = (field: keyof BasicInfo, value: number) => {
    setBasic((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const onAssumptionChange = (field: keyof GrowthAssumptions, value: number) => {
    setAssumptions((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateBreakpoint = (
    index: number,
    field: keyof ContributionBreakpoint,
    value: number,
  ) => {
    setPlan((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...prev.breakpoints];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, breakpoints: next };
    });
  };

  const addBreakpoint = () => {
    setPlan((prev) => {
      const template: ContributionBreakpoint = {
        fromAge: basic?.currentAge ?? 30,
        base: 5000,
        changeYoY: 0,
        years: 5,
      };
      if (!prev) {
        return { breakpoints: [template] };
      }
      return { ...prev, breakpoints: [...prev.breakpoints, template] };
    });
  };

  const duplicateBreakpoint = (index: number) => {
    setPlan((prev) => {
      if (!prev) {
        return prev;
      }
      const copy = prev.breakpoints[index];
      return {
        ...prev,
        breakpoints: [
          ...prev.breakpoints.slice(0, index + 1),
          { ...copy },
          ...prev.breakpoints.slice(index + 1),
        ],
      };
    });
  };

  const removeBreakpoint = (index: number) => {
    setPlan((prev) => {
      if (!prev) {
        return prev;
      }
      const next = prev.breakpoints.filter((_, idx) => idx !== index);
      return { ...prev, breakpoints: next.length ? next : prev.breakpoints };
    });
  };

  const savingsSummary = plan?.breakpoints
    .map((bp) => {
      const endAge = bp.years ? bp.fromAge + bp.years : basic?.retirementAge;
      return `${bp.base.toLocaleString()} → age ${endAge ?? ""}`;
    })
    .join(", ");

  if (isLoadingDefaults) {
    return (
      <div className="page">
        <div className="loading">loading calculator defaults...</div>
      </div>
    );
  }

  if (!basic || !assumptions || !plan) {
    return (
      <div className="page">
        <div className="loading">unable to initialize calculator</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Detailed Compound Interest Calculator</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Plan, compare, and project with multiple growth cases.
          </p>
        </div>
        <div className="nav">
          <button>Home</button>
          <button className="active">Calculator</button>
        </div>
      </header>

      <div className="content">
        <div className="panel">
          <section className="section">
            <h2>Basic Information</h2>
            <div className="grid-two">
              <InputField
                label="Current Age"
                value={basic.currentAge}
                onChange={(value) => onBasicChange("currentAge", value)}
              />
              <InputField
                label="Retirement Age"
                value={basic.retirementAge}
                onChange={(value) => onBasicChange("retirementAge", value)}
              />
              <InputField
                label="Current Savings (USD)"
                value={basic.currentSavings}
                onChange={(value) => onBasicChange("currentSavings", value)}
              />
              <InputField
                label="Desired Annual Retirement Spending (USD)"
                value={basic.retirementSpendingRaw}
                onChange={(value) => onBasicChange("retirementSpendingRaw", value)}
              />
            </div>
            <div className="inline-note">
              We&apos;ll pre-fill detailed planning with these figures. Savings feed the
              first account&apos;s starting balance, and retirement spending seeds the
              withdrawal schedule. You can fine-tune both later.
            </div>
          </section>

          <section className="section">
            <h2>Growth Assumptions</h2>
            <div className="grid-two">
              <InputField
                label="Annual Inflation (decimal)"
                value={assumptions.annualInflation}
                step={0.005}
                onChange={(value) => onAssumptionChange("annualInflation", value)}
              />
              <InputField
                label="Inflation Error Margin"
                value={assumptions.inflationErrorMargin}
                step={0.005}
                onChange={(value) => onAssumptionChange("inflationErrorMargin", value)}
              />
              <InputField
                label="Investment Growth Rate (decimal)"
                value={assumptions.investmentReturnRate}
                step={0.005}
                onChange={(value) => onAssumptionChange("investmentReturnRate", value)}
              />
              <InputField
                label="Investment Error Margin"
                value={assumptions.investmentReturnErrorMargin}
                step={0.005}
                onChange={(value) =>
                  onAssumptionChange("investmentReturnErrorMargin", value)
                }
              />
            </div>
            <div className="summary-pill">
              Inflation band: {percent(assumptions.annualInflation - assumptions.inflationErrorMargin)}{" "}
              – {percent(assumptions.annualInflation)} –{" "}
              {percent(assumptions.annualInflation + assumptions.inflationErrorMargin)}
            </div>
            <div className="summary-pill">
              Growth band:{" "}
              {percent(
                assumptions.investmentReturnRate - assumptions.investmentReturnErrorMargin,
              )}{" "}
              – {percent(assumptions.investmentReturnRate)} –{" "}
              {percent(
                assumptions.investmentReturnRate + assumptions.investmentReturnErrorMargin,
              )}
            </div>
            <div className="inline-note">
              We use the margin to calculate the min and max scenarios around your average
              growth assumption.
            </div>
          </section>

          <section className="section">
            <h2>Detailed Planning</h2>
            <div className="small-card">
              Configure multi-year savings schedules, account growth overrides, and
              retirement spending.
            </div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Contribution schedule</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>From age</th>
                    <th>Base contribution</th>
                    <th>Annual growth</th>
                    <th>Years</th>
                    <th>Estimated end age</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.breakpoints.map((bp, index) => {
                    const endAge = bp.years
                      ? bp.fromAge + (bp.years ?? 0)
                      : basic.retirementAge;
                    return (
                      <tr key={`${bp.fromAge}-${index}`} className="breakpoint-row">
                        <td>
                          <input
                            type="number"
                            value={bp.fromAge}
                            onChange={(event) =>
                              updateBreakpoint(index, "fromAge", Number(event.target.value))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={bp.base}
                            onChange={(event) =>
                              updateBreakpoint(index, "base", Number(event.target.value))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step={0.005}
                            value={bp.changeYoY}
                            onChange={(event) =>
                              updateBreakpoint(
                                index,
                                "changeYoY",
                                Number(event.target.value),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={bp.years ?? 0}
                            onChange={(event) =>
                              updateBreakpoint(index, "years", Number(event.target.value))
                            }
                          />
                        </td>
                        <td>{endAge}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => duplicateBreakpoint(index)}>
                              +
                            </button>
                            <button type="button" onClick={() => removeBreakpoint(index)}>
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="secondary-button" onClick={addBreakpoint}>
                + Add breakpoint
              </button>
              {savingsSummary && (
                <div className="inline-note">
                  Total scheduled contributions track as {savingsSummary}.
                </div>
              )}
            </div>

            <div>
              <h3 style={{ margin: "16px 0 8px" }}>Edit yearly retirement spending</h3>
              <div className="inline-note">
                Retirement drawdown editing will plug into projections soon. For now we
                keep the base amount synced with the basic information above.
              </div>
            </div>
          </section>
        </div>

        <div className="chart-panel">
          <div className="chart-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Your Savings Journey</h2>
              <p style={{ margin: 0, color: "#475569" }}>
                Compare min / average / max projections. Toggle between nominal dollars and
                today&apos;s value.
              </p>
            </div>
            <div className="toggle-group">
              <button
                className={valueMode === "nominal" ? "active" : ""}
                onClick={() => setValueMode("nominal")}
              >
                Nominal $
              </button>
              <button
                className={valueMode === "real" ? "active" : ""}
                onClick={() => setValueMode("real")}
              >
                Today&apos;s $
              </button>
            </div>
          </div>

          <div className="chart-legend">
            <span className="legend-pill min">Min</span>
            <span className="legend-pill avg">Avg</span>
            <span className="legend-pill max">Max</span>
          </div>

          {error && <div className="inline-note" style={{ color: "#dc2626" }}>{error}</div>}

          <div style={{ width: "100%", height: 420 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="age" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="min" stroke="#2563eb" strokeWidth={3} dot={false} name="Min" />
                <Line type="monotone" dataKey="avg" stroke="#dc2626" strokeWidth={3} dot={false} name="Avg" />
                <Line type="monotone" dataKey="max" stroke="#f59e0b" strokeWidth={3} dot={false} name="Max" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid-two">
            <div className="small-card">
              Current savings: <strong>{currency.format(basic.currentSavings)}</strong>
              <br />
              Retirement spending (today&apos;s dollars):{" "}
              <strong>{currency.format(basic.retirementSpendingRaw)}</strong>
            </div>
            <div className="small-card">
              First retirement-year withdrawal ≈{" "}
              <strong>
                {currency.format(
                  basic.retirementSpendingRaw *
                    (1 + assumptions.annualInflation) **
                      (basic.retirementAge - basic.currentAge),
                )}
              </strong>
            </div>
          </div>

          {totals && (
            <div className="inline-note">
              Projected balances at age {basic.retirementAge}: {totals.min} · {totals.avg} ·{" "}
              {totals.max}
            </div>
          )}

          {isLoadingProjection && (
            <div className="loading">Updating chart with your latest inputs...</div>
          )}
        </div>
      </div>

      <footer style={{ color: "#94a3b8", textAlign: "center", fontSize: "0.85rem" }}>
        Educational illustration only. Adapt the assumptions to match your financial plan.
      </footer>
    </div>
  );
}
