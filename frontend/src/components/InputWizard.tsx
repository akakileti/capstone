import { useEffect, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { formatCurrency } from "../lib/calc";
import { formatPercentage } from "../lib/number-format";
import { planSchema, type Plan } from "../lib/schemas";

interface InputWizardProps {
  plan: Plan;
  onSubmit: (plan: Plan) => void;
  loading?: boolean;
}

export function InputWizard({ plan, onSubmit, loading = false }: InputWizardProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<Plan>({
    resolver: zodResolver(planSchema),
    defaultValues: plan,
  });

  useEffect(() => {
    reset(plan);
  }, [plan, reset]);

  const startAge = watch("startAge");
  const retireAge = watch("retireAge");
  const initialBalance = watch("initialBalance") ?? plan.initialBalance;
  const startingRetirementSpending =
    watch("startingRetirementSpending") ?? plan.startingRetirementSpending;
  const invalidRetirementAge =
    startAge !== undefined && retireAge !== undefined && retireAge <= startAge;

  const inflation = watch("inflationRate") ?? plan.inflationRate;
  const inflationMargin = watch("inflationMargin") ?? plan.inflationMargin;
  const invest = watch("investmentGrowthRate") ?? plan.investmentGrowthRate;
  const investMargin = watch("investmentGrowthMargin") ?? plan.investmentGrowthMargin;

  const submit = handleSubmit((values) => onSubmit({ ...plan, ...values }));

  const yearsUntilRetirement = Math.max((retireAge ?? plan.retireAge) - (startAge ?? plan.startAge), 0);
  const retirementNominal = startingRetirementSpending * Math.pow(1 + inflation, yearsUntilRetirement);

  const derived = {
    inflationMin: Math.max(inflation - inflationMargin, 0),
    inflationMax: inflation + inflationMargin,
    growthMin: invest - investMargin,
    growthMax: invest + investMargin,
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <SectionCard title="Basic Information">
        <Field label="Current Age" error={errors.startAge?.message}>
          <input
            className={inputClassName}
            type="number"
            step="1"
            {...register("startAge", { valueAsNumber: true })}
          />
        </Field>

        <Field label="Retirement Age" error={errors.retireAge?.message}>
          <input
            className={inputClassName}
            type="number"
            step="1"
            {...register("retireAge", { valueAsNumber: true })}
          />
          {invalidRetirementAge && (
            <p className="text-xs text-red-600">Retirement age must be greater than current age.</p>
          )}
        </Field>

        <Field label="Current Savings (USD)" error={errors.initialBalance?.message}>
          <input
            className={inputClassName}
            type="number"
            step="100"
            {...register("initialBalance", { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Desired Annual Retirement Spending (USD, today&apos;s dollars)"
          error={errors.startingRetirementSpending?.message}
        >
          <input
            className={inputClassName}
            type="number"
            step="100"
            {...register("startingRetirementSpending", { valueAsNumber: true })}
          />
        </Field>

        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          We&apos;ll pre-fill detailed planning with these figures. Savings feed the first account&apos;s starting
          balance, and retirement spending seeds the withdrawal schedule. You can fine-tune both later.
        </p>
      </SectionCard>

      <SectionCard title="Growth Assumptions">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Annual Inflation (decimal)" error={errors.inflationRate?.message}>
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              {...register("inflationRate", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Error Margin" error={errors.inflationMargin?.message}>
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              {...register("inflationMargin", { valueAsNumber: true })}
            />
          </Field>
        </div>

        <SummaryPill
          label="Inflation band"
          value={`${formatPercentage(derived.inflationMin)} – ${formatPercentage(inflation)} – ${formatPercentage(derived.inflationMax)}`}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Investment Growth Rate (decimal)" error={errors.investmentGrowthRate?.message}>
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              {...register("investmentGrowthRate", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Error Margin" error={errors.investmentGrowthMargin?.message}>
            <input
              className={inputClassName}
              type="number"
              step="0.001"
              {...register("investmentGrowthMargin", { valueAsNumber: true })}
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
            Current savings: <span className="font-semibold text-slate-900">{formatCurrency(initialBalance)}</span>
          </p>
          <p>
            Retirement spending (today&apos;s dollars):{" "}
            <span className="font-semibold text-slate-900">
              {formatCurrency(startingRetirementSpending)}
            </span>
          </p>
          <p className="mt-1">
            First retirement-year withdrawal ≈ {formatCurrency(retirementNominal)} nominal (assuming {formatPercentage(inflation)} inflation).
          </p>
        </div>
      </SectionCard>

      <button
        className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Calculating…" : "Run Projection"}
      </button>
    </form>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
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
