import type { ChangeEvent, ReactNode } from "react";

import { formatCurrency } from "../lib/calc";
import { formatPercentage } from "../lib/number-format";
import type { Plan } from "../lib/schemas";

interface InputWizardProps {
  plan: Plan;
  onPlanChange: (updater: (plan: Plan) => Plan) => void;
}

type NumericField =
  | "startAge"
  | "retireAge"
  | "initialBalance"
  | "startingRetirementSpending"
  | "inflationRate"
  | "inflationMargin"
  | "investmentGrowthRate"
  | "investmentGrowthMargin";

export function InputWizard({ plan, onPlanChange }: InputWizardProps) {
  const fieldMin: Record<NumericField, number> = {
    startAge: 0,
    retireAge: 0,
    initialBalance: 0,
    startingRetirementSpending: 0,
    inflationRate: 0,
    inflationMargin: 0,
    investmentGrowthRate: 0,
    investmentGrowthMargin: 0,
  };

  const marginToRate: Partial<Record<NumericField, NumericField>> = {
    inflationMargin: "inflationRate",
    investmentGrowthMargin: "investmentGrowthRate",
  };

  const getNumeric = (p: Plan, key: NumericField): number => {
    const value = p[key];
    return typeof value === "number" ? value : 0;
  };

  const hasMultipleAccounts = plan.accounts.length > 1;
  const hasDetailedSpending = plan.spendingSchedule.length > 1;

  const handleNumberChange =
    (field: NumericField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (field === "initialBalance" && hasMultipleAccounts) {
        // Once multiple accounts exist, initial balance must be edited per-account in detailed planning.
        return;
      }
      if (field === "startingRetirementSpending" && hasDetailedSpending) {
        // Once multiple retirement spending rows exist, edit them in Detailed Planning.
        return;
      }

      const value = Number(event.target.value);
      if (Number.isNaN(value)) {
        return;
      }
      const minValue = fieldMin[field] ?? Number.NEGATIVE_INFINITY;
      let sanitized = Math.max(value, minValue);

      // Clamp margin so it cannot exceed its paired rate
      const pairedRate = marginToRate[field];
      if (pairedRate) {
        const currentRate = Math.max(getNumeric(plan, pairedRate), fieldMin[pairedRate]);
        sanitized = Math.min(sanitized, currentRate);
      }

      // Update state and, if a rate changes, also clamp its margin
      onPlanChange((current) => {
        const next: Plan = { ...current, [field]: sanitized };

        if (field === "initialBalance" && !hasMultipleAccounts) {
          // Keep the first account's starting balance in sync when only one account exists
          const [firstAccount, ...rest] = current.accounts;
          if (firstAccount) {
            next.accounts = [{ ...firstAccount, initialBalance: sanitized }, ...rest];
          }
        }
        if (field === "startingRetirementSpending" && !hasDetailedSpending) {
          // Keep the first spending row in sync when only a single row exists
          const [firstRow, ...restRows] = current.spendingSchedule;
          if (firstRow) {
            next.spendingSchedule = [{ ...firstRow, annualSpending: sanitized }, ...restRows];
          }
        }

        const pairedMargin = (Object.entries(marginToRate).find(([, rate]) => rate === field)?.[0] ??
          null) as NumericField | null;
        if (pairedMargin) {
          const marginMin = fieldMin[pairedMargin];
          const marginValue = getNumeric(next, pairedMargin);
          next[pairedMargin] = Math.min(Math.max(marginValue, marginMin), sanitized) as Plan[typeof pairedMargin];
        }

        return next;
      });
    };

  const startAge = plan.startAge;
  const retireAge = plan.retireAge;
  const invalidRetirementAge = retireAge <= startAge;

  const inflation = plan.inflationRate;
  const inflationMargin = plan.inflationMargin;
  const invest = plan.investmentGrowthRate;
  const investMargin = plan.investmentGrowthMargin;

  const yearsUntilRetirement = Math.max(retireAge - startAge, 0);
  const retirementNominal =
    plan.startingRetirementSpending * Math.pow(1 + inflation, yearsUntilRetirement);

  const derived = {
    inflationMin: Math.max(inflation - inflationMargin, 0),
    inflationMax: inflation + inflationMargin,
    growthMin: invest - investMargin,
    growthMax: invest + investMargin,
  };

  return (
    <div className="grid gap-4">
      <SectionCard title="Basic Information">
        <Field label="Current Age">
          <input
            className={inputClassName}
            type="number"
            step="1"
            min={0}
            value={plan.startAge}
            onChange={handleNumberChange("startAge")}
          />
        </Field>

        <Field label="Retirement Age">
          <input
            className={inputClassName}
            type="number"
            step="1"
            min={0}
            value={plan.retireAge}
            onChange={handleNumberChange("retireAge")}
          />
          {invalidRetirementAge && (
            <p className="text-xs text-red-600">Retirement age must be greater than current age.</p>
          )}
        </Field>

        <Field label="Current Savings (USD)">
          <input
            className={inputClassName}
            type="number"
            step="100"
            value={hasMultipleAccounts ? "" : plan.initialBalance}
            onChange={handleNumberChange("initialBalance")}
            placeholder={hasMultipleAccounts ? "Set per account in Detailed Planning" : undefined}
            disabled={hasMultipleAccounts}
          />
          {hasMultipleAccounts ? (
            <p className="text-xs text-slate-500">With multiple accounts, edit starting balances in Detailed Planning.</p>
          ) : null}
        </Field>

        <Field label="Desired Annual Retirement Spending (USD, today&apos;s dollars)">
          <input
            className={inputClassName}
            type="number"
            step="100"
            value={hasDetailedSpending ? "" : plan.startingRetirementSpending}
            onChange={handleNumberChange("startingRetirementSpending")}
            placeholder={hasDetailedSpending ? "Set in Detailed Planning withdrawals" : undefined}
            disabled={hasDetailedSpending}
          />
          {hasDetailedSpending ? (
            <p className="text-xs text-slate-500">With multiple withdrawal rows, make changes in Detailed Planning.</p>
          ) : null}
        </Field>

        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          We&apos;ll pre-fill detailed planning with these figures. Savings feed the first account&apos;s starting
          balance, and retirement spending seeds the withdrawal schedule. You can fine-tune both later.
        </p>
      </SectionCard>

      <SectionCard title="Growth Assumptions">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Annual Inflation (decimal)">
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              min={0}
              value={plan.inflationRate}
              onChange={handleNumberChange("inflationRate")}
            />
          </Field>
          <Field label="Error Margin">
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              min={0}
              value={plan.inflationMargin}
              onChange={handleNumberChange("inflationMargin")}
            />
          </Field>
        </div>

        <SummaryPill
          label="Inflation band"
          value={`${formatPercentage(derived.inflationMin)} – ${formatPercentage(inflation)} – ${formatPercentage(derived.inflationMax)}`}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Investment Growth Rate (decimal)">
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              min={0}
              value={plan.investmentGrowthRate}
              onChange={handleNumberChange("investmentGrowthRate")}
            />
          </Field>
          <Field label="Error Margin">
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              min={0}
              value={plan.investmentGrowthMargin}
              onChange={handleNumberChange("investmentGrowthMargin")}
            />
          </Field>
        </div>

        <SummaryPill
          label="Growth band"
          value={`${formatPercentage(derived.growthMin)} – ${formatPercentage(invest)} – ${formatPercentage(derived.growthMax)}`}
        />


        <p className="text-xs text-slate-500">
          We use the margin to calculate the Min and Max scenarios around your average growth assumption.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p>
            Current savings: <span className="font-semibold text-slate-900">{formatCurrency(plan.initialBalance)}</span>
          </p>
          <p>
            Retirement spending (today&apos;s dollars):{" "}
            <span className="font-semibold text-slate-900">
              {formatCurrency(plan.startingRetirementSpending)}
            </span>
          </p>
          <p className="mt-1">
            First retirement-year withdrawal ≈ {formatCurrency(retirementNominal)} nominal (assuming {formatPercentage(inflation)} inflation).
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60";

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

interface SectionCardProps {
  title: string;
  children: ReactNode;
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
      <details open className="group space-y-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-slate-800">
          <span>{title}</span>
          <span className="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-500 transition group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="space-y-3">{children}</div>
      </details>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="font-mono text-slate-900">{value}</span>
    </div>
  );
}
