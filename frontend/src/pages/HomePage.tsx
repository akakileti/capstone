import {
  Bar,
  BarChart,
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HomePageProps = {
  onStart?: () => void;
};

const heroData = [
  { age: 25, min: 18_000, avg: 24_000, max: 30_500 },
  { age: 35, min: 76_000, avg: 95_000, max: 118_000 },
  { age: 45, min: 162_000, avg: 212_000, max: 280_000 },
  { age: 55, min: 295_000, avg: 402_000, max: 535_000 },
  { age: 65, min: 430_000, avg: 610_000, max: 820_000 },
];

const inflationDrift = Array.from({ length: 16 }, (_, i) => {
  const years = i * 2;
  const decay = (rate: number) => Number((100 / Math.pow(1 + rate, years)).toFixed(2));
  return {
    years,
    two: decay(0.02),
    three: decay(0.03),
    five: decay(0.05),
  };
});

const rollingReturns = [
  { start: 1950, value: 4.1 },
  { start: 1960, value: 3.7 },
  { start: 1970, value: 2.9 },
  { start: 1980, value: 5.4 },
  { start: 1990, value: 4.6 },
  { start: 2000, value: 3.2 },
  { start: 2005, value: 3.8 },
  { start: 2010, value: 4.4 },
  { start: 2015, value: 4.1 },
  { start: 2020, value: 3.6 },
  { start: 2024, value: 3.9 },
];

const spendingShift = [
  { label: "65-74", amount: 65354 },
  { label: "75+", amount: 55834 },
];

const inflationContext = [
  { year: 1995, cpi: 2.8 },
  { year: 2000, cpi: 3.4 },
  { year: 2005, cpi: 3.4 },
  { year: 2010, cpi: 1.6 },
  { year: 2015, cpi: 0.1 },
  { year: 2020, cpi: 1.2 },
  { year: 2022, cpi: 6.5 },
  { year: 2023, cpi: 3.1 },
  { year: 2024, cpi: 2.9 },
];

const savingsReality = [
  { band: "35-44", value: 45_000 },
  { band: "45-54", value: 115_000 },
  { band: "55-64", value: 185_000 },
  { band: "65-74", value: 200_000 },
];

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
};

export default function HomePage({ onStart }: HomePageProps) {
  return (
    <main className="mt-10 space-y-8 text-slate-700">
      <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Retirement, simplified</p>
          <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
            Build a data-backed retirement projection without linking your accounts.
          </h1>
          <p className="text-base text-slate-600">
            Compare optimistic, average, and conservative paths. See how assumptions change the runway and know when to
            course correct.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              Build your projection
            </button>
            <p className="text-xs text-slate-500 self-center">Takes about 2 minutes.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
          <div aria-label="Example projection chart" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={heroData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="age" tick={{ fontSize: 12, fill: "#475569" }} label={{ value: "age", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={formatCurrencyCompact} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="min" name="Min" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg" name="Average" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="max" name="Max" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-500">Example only. Your inputs drive the result.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900">What You Should Know</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Retirement Lasts Decades</h3>
                <p className="text-xs text-slate-600">Common planning range: 20-30 years</p>
              </div>
            </div>
            <div
              className="mt-4 rounded-xl bg-white px-4 py-4 ring-1 ring-slate-200"
              aria-label="Common retirement planning range is 20 to 30 years on a 0 to 40 year scale."
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-2">
                Common planning range
              </p>
              <div className="relative h-3 rounded-full bg-slate-100">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <span
                    key={pct}
                    className="absolute -top-1 h-5 w-[1px] bg-slate-300"
                    style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                    aria-hidden
                  />
                ))}
                <div
                  className="absolute inset-y-0 rounded-full bg-slate-400"
                  style={{ left: "50%", right: "25%" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>0 yrs</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
                <span>40</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">Many plans assume 20 to 30 years after retirement.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Inflation Shrinks Purchasing Power</h3>
                <p className="text-xs text-slate-600">Comparing steady inflation rates.</p>
              </div>
            </div>
            <div className="mt-3 h-48" aria-label="Inflation purchasing power chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inflationDrift} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="years" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis domain={[0, 110]} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)} index`} />
                  <Legend />
                  <Line type="monotone" dataKey="two" name="2%" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="three" name="3%" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="five" name="5%" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-600">At 3% inflation, purchasing power halves in about 24 years.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Long-Horizon Returns Vary</h3>
                <p className="text-xs text-slate-600">Rolling 30-year real return (sampled).</p>
              </div>
            </div>
            <div className="mt-3 h-48" aria-label="Rolling returns chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingReturns} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="start" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <ReferenceLine y={4} label={{ value: "long-run average", position: "right", fontSize: 10, fill: "#475569" }} stroke="#cbd5e1" strokeDasharray="4 4" />
                  <defs>
                    <linearGradient id="returnsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="transparent"
                    fill="url(#returnsArea)"
                    isAnimationActive={false}
                  />
                  <Line type="monotone" dataKey="value" name="30-year real return" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-600">Long horizons reduce noise, but outcomes still vary.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Spending Changes</h3>
                <p className="text-xs text-slate-600">Average annual spending by age band (USD).</p>
              </div>
            </div>
            <div className="mt-3 h-48" aria-label="Spending by age chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingShift} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="amount" name="Annual spend" fill="#6366f1" radius={[10, 10, 6, 6]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-600">Spending patterns shift with age.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Why This Matters</h2>
          <p className="text-sm text-slate-600">Retirement readiness is uneven. These snapshots show the stakes.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "39% of households are at risk of not maintaining their pre-retirement living standard in retirement.",
              source: "Source: Boston College CRR (NRR I)",
            },
            {
              label: "Average retired worker benefit (Jan 2026): $2,074.53 per month",
              source: "Source: Social Security Administration",
            },
            {
              label: "63% of retirees rely on Social Security for at least half their income.",
              source: "Source: SSA Income of the Population 55+, 2022",
            },
          ].map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner"
            >
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.source}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Savings Reality</h2>
          <p className="text-sm text-slate-600">Median retirement savings varies significantly by age.</p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
          <div className="h-64" aria-label="Median retirement savings by age chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsReality} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="band" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 12, fill: "#475569" }} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" name="Median balance" fill="#6366f1" radius={[10, 10, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Median retirement account balances increase with age but often remain below what full retirement funding would require.
          </p>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">Source: Federal Reserve Survey of Consumer Finances</p>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Typical baseline assumptions</h2>
              <p className="text-sm text-slate-600">Recent inflation gives context for planning inputs.</p>
            </div>
          </div>
          <div className="mt-4 h-52" aria-label="Inflation history chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inflationContext} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis domain={[0, 8]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "#475569" }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="cpi" name="CPI YoY%" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                <ReferenceLine y={3} stroke="#cbd5e1" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-4">
          <div className="flex flex-wrap gap-3">
            {["inflation: 3%", "nominal return: 5-7%", "retirement length: 20-30 years"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 shadow-inner"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            These are common planning assumptions, not predictions. Adjust them in the calculator to reflect your own
            mix of savings, risk, and time horizon.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">How this tool is different</h2>
          <p className="text-sm text-slate-600">Purpose-built for young professionals planning early.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            "Models working years and retirement years",
            "Compares min, average, max scenarios",
            "Supports multiple accounts and tax treatments",
            "No account linking required",
          ].map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-900 shadow-inner"
            >
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Ready to build your projection?</h2>
        <p className="mt-2 text-sm text-slate-600">No account linking. Export to Excel when you want.</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-5 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800"
        >
          Build your projection
        </button>
      </section>
    </main>
  );
}
