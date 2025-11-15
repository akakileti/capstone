import type { BasicInfo, Breakpoint, GrowthAssumptions } from "../lib/types";
import { formatCurrency } from "../lib/calc";

interface SidebarProps {
  basicInfo: BasicInfo;
  growthAssumptions: GrowthAssumptions;
  breakpoints: Breakpoint[];
  onBasicInfoChange: (field: keyof BasicInfo, value: number) => void;
  onGrowthChange: (field: keyof GrowthAssumptions, value: number) => void;
  onBreakpointChange: <K extends keyof Breakpoint>(
    index: number,
    field: K,
    value: Breakpoint[K]
  ) => void;
  onAddBreakpoint: () => void;
  onRemoveBreakpoint: (index: number) => void;
  formattedFirstWithdrawal: string;
  totalScheduledContribution: string;
}

export default function Sidebar({
  basicInfo,
  growthAssumptions,
  breakpoints,
  onBasicInfoChange,
  onGrowthChange,
  onBreakpointChange,
  onAddBreakpoint,
  onRemoveBreakpoint,
  formattedFirstWithdrawal,
  totalScheduledContribution,
}: SidebarProps) {
  const inflationBand = buildBand(
    growthAssumptions.annualInflation,
    growthAssumptions.inflationErrorMargin
  );
  const growthBand = buildBand(
    growthAssumptions.investmentReturnRate,
    growthAssumptions.investmentReturnErrorMargin
  );

  return (
    <aside className="sidebar">
      <header className="hero">
        <div>
          <p className="eyebrow">Detailed Compound Interest Calculator</p>
          <h1>Plan, compare, and project with multiple growth cases.</h1>
        </div>
        <nav>
          <a className="nav-link" href="#">Home</a>
          <a className="nav-link active" href="#">Calculator</a>
        </nav>
      </header>

      <section className="card">
        <SectionHeading title="Basic Information" />
        <div className="form-grid">
          <NumberField
            label="Current Age"
            value={basicInfo.currentAge}
            min={18}
            max={100}
            onChange={(value) => onBasicInfoChange("currentAge", value)}
          />
          <NumberField
            label="Retirement Age"
            value={basicInfo.retirementAge}
            min={basicInfo.currentAge + 1}
            max={100}
            onChange={(value) => onBasicInfoChange("retirementAge", value)}
          />
          <CurrencyField
            label="Current Savings (USD)"
            value={basicInfo.currentSavings}
            onChange={(value) => onBasicInfoChange("currentSavings", value)}
          />
          <CurrencyField
            label="Desired Annual Retirement Spending (USD, today's dollars)"
            value={basicInfo.retirementSpendingRaw}
            onChange={(value) => onBasicInfoChange("retirementSpendingRaw", value)}
          />
        </div>
        <p className="muted-box">
          we&apos;ll pre-fill detailed planning with these figures. savings feed the first account&apos;s
          starting balance, and retirement spending seeds the withdrawal schedule. you can fine-tune
          both later.
        </p>
      </section>

      <section className="card">
        <SectionHeading title="Growth Assumptions" />
        <div className="form-grid">
          <NumberField
            label="Annual Inflation (decimal)"
            step={0.001}
            value={growthAssumptions.annualInflation}
            onChange={(value) => onGrowthChange("annualInflation", value)}
          />
          <NumberField
            label="Inflation Error Margin"
            step={0.001}
            value={growthAssumptions.inflationErrorMargin}
            onChange={(value) => onGrowthChange("inflationErrorMargin", value)}
          />
          <NumberField
            label="Investment Growth Rate (decimal)"
            step={0.001}
            value={growthAssumptions.investmentReturnRate}
            onChange={(value) => onGrowthChange("investmentReturnRate", value)}
          />
          <NumberField
            label="Investment Error Margin"
            step={0.001}
            value={growthAssumptions.investmentReturnErrorMargin}
            onChange={(value) => onGrowthChange("investmentReturnErrorMargin", value)}
          />
        </div>
        <div className="pill-row">
          <BandPill label="Inflation band" values={inflationBand} />
          <BandPill label="Growth band" values={growthBand} />
        </div>
        <p className="footnote">
          current savings: {formatCurrency(basicInfo.currentSavings)} · retirement spending (today&apos;s
          dollars): {formatCurrency(basicInfo.retirementSpendingRaw)} · first retirement-year withdrawal
          ≈ {formattedFirstWithdrawal}
        </p>
      </section>

      <section className="card">
        <SectionHeading title="Detailed Planning" />
        <p className="section-copy">
          configure multi-year savings schedules, account growth overrides, and retirement spending.
          each breakpoint below controls the contribution pattern until the next breakpoint (or
          retirement).
        </p>

        <div className="table-scroll">
          <table className="breakpoint-table">
            <thead>
              <tr>
                <th>From age</th>
                <th>Base contribution</th>
                <th>Annual growth</th>
                <th>Years</th>
                <th>Estimated end age</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {breakpoints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No scheduled contributions yet.
                  </td>
                </tr>
              ) : (
                breakpoints.map((row, index) => (
                  <tr key={`${row.fromAge}-${index}`}>
                    <td>
                      <input
                        type="number"
                        min={basicInfo.currentAge}
                        max={basicInfo.retirementAge}
                        value={row.fromAge}
                        onChange={(event) =>
                          onBreakpointChange(index, "fromAge", ensureNumber(event.target.valueAsNumber, row.fromAge))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={row.base}
                        onChange={(event) =>
                          onBreakpointChange(index, "base", ensureNumber(event.target.valueAsNumber, row.base))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.001}
                        value={row.changeYoY}
                        onChange={(event) =>
                          onBreakpointChange(
                            index,
                            "changeYoY",
                            ensureNumber(event.target.valueAsNumber, row.changeYoY)
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={row.years ?? ""}
                        onChange={(event) => {
                          const nextYears = Number.isNaN(event.target.valueAsNumber)
                            ? null
                            : ensureNumber(event.target.valueAsNumber, row.years ?? 0);
                          onBreakpointChange(index, "years", nextYears);
                        }}
                      />
                    </td>
                    <td>{estimateEndAge(row, basicInfo.retirementAge)}</td>
                    <td>
                      <button className="ghost-button" type="button" onClick={() => onRemoveBreakpoint(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-actions">
          <button className="primary-button" type="button" onClick={onAddBreakpoint}>
            + Add Breakpoint
          </button>
          <p className="footnote">
            total scheduled contributions: {totalScheduledContribution} by age {basicInfo.retirementAge}
          </p>
        </div>
      </section>
    </aside>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(ensureNumber(event.target.valueAsNumber, value))}
      />
    </label>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(ensureNumber(event.target.valueAsNumber, value))}
      />
    </label>
  );
}

function BandPill({ label, values }: { label: string; values: [number, number, number] }) {
  return (
    <div className="pill">
      <p>{label}</p>
      <p>{values.map((value) => formatPercent(value)).join(" – ")}</p>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildBand(center: number, margin: number): [number, number, number] {
  return [Math.max(center - margin, 0), center, center + margin];
}

function ensureNumber(nextValue: number, fallback: number): number {
  if (Number.isNaN(nextValue)) {
    return fallback;
  }
  return nextValue;
}

function estimateEndAge(row: Breakpoint, retirementAge: number) {
  if (row.years === null || typeof row.years === "undefined") {
    return retirementAge;
  }
  return row.fromAge + row.years;
}
