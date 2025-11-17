import { useEffect, useState } from "react";

import { ChartPanel } from "./components/ChartPanel";
import { DetailedPlanningPanel } from "./components/DetailedPlanningPanel";
import { InputWizard } from "./components/InputWizard";
import axios from "axios";

import { runProjection } from "./lib/api";
import { type ProjectionCase } from "./lib/calc";
import { defaultPlan, type Account, type Plan } from "./lib/schemas";

const clampRate = (value: number) => Math.min(Math.max(value, -0.5), 1);

const recomputeScenarios = (plan: Plan): Plan => {
  const base = plan.investmentGrowthRate;
  const margin = plan.investmentGrowthMargin;
  return {
    ...plan,
    scenarios: [
      { kind: "min", nominalRate: clampRate(base - margin) },
      { kind: "avg", nominalRate: clampRate(base) },
      { kind: "max", nominalRate: clampRate(base + margin) },
    ],
  };
};

const ensureAccounts = (plan: Plan): Plan => {
  const baseInitial = plan.initialBalance ?? plan.accounts[0]?.initialBalance ?? 0;
  let accounts = plan.accounts.length ? plan.accounts : [];

  if (accounts.length === 0) {
    const derivedYears = Math.max(plan.retireAge - plan.startAge, 1);
    accounts = [
      {
        label: "General",
        note: "",
        initialBalance: baseInitial,
        contributions:
          plan.annualContribution && plan.annualContribution > 0
            ? [
                {
                  fromAge: plan.startAge,
                  base: plan.annualContribution,
                  growthRate: 0,
                  years: derivedYears,
                },
              ]
            : [],
        growthOverrides: [],
      },
    ] satisfies Account[];
  }

  const updatedAccounts = accounts.map((account, index) =>
    index === 0 ? { ...account, initialBalance: baseInitial } : account,
  );

  return {
    ...plan,
    initialBalance: baseInitial,
    accounts: updatedAccounts,
  };
};

const ensureSpending = (plan: Plan): Plan => {
  const schedule = plan.spendingSchedule.slice().sort((a, b) => a.fromAge - b.fromAge);
  const hasEntry = schedule.findIndex((row) => row.fromAge === plan.retireAge);

  if (plan.startingRetirementSpending > 0) {
    if (hasEntry >= 0) {
      schedule[hasEntry] = {
        ...schedule[hasEntry],
        annualSpending: plan.startingRetirementSpending,
      };
    } else {
      schedule.push({
        fromAge: plan.retireAge,
        annualSpending: plan.startingRetirementSpending,
        years: 25,
      });
    }
  } else if (hasEntry >= 0) {
    schedule.splice(hasEntry, 1);
  }

  const retireRow = schedule.find((row) => row.fromAge === plan.retireAge);

  return {
    ...plan,
    startingRetirementSpending: retireRow ? retireRow.annualSpending : 0,
    spendingSchedule: schedule,
  };
};

const preparePlan = (plan: Plan): Plan => {
  const withAccounts = ensureAccounts(plan);
  const withSpending = ensureSpending(withAccounts);
  return recomputeScenarios({
    ...withSpending,
    nominalGrowthRate: withSpending.nominalGrowthRate ?? withSpending.investmentGrowthRate,
  });
};

function extractValidationMessage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const typed = entry as { msg?: unknown; loc?: unknown };
          const message = typeof typed.msg === "string" ? typed.msg : null;
          const location = Array.isArray(typed.loc) ? typed.loc.join(".") : null;
          if (message && location) return `${location}: ${message}`;
          return message;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const typed = value as { msg?: unknown; loc?: unknown };
    const message = typeof typed.msg === "string" ? typed.msg : null;
    if (message) {
      const location = Array.isArray(typed.loc) ? typed.loc.join(".") : null;
      return location ? `${location}: ${message}` : message;
    }
  }
  return null;
}

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => preparePlan(defaultPlan));
  const [results, setResults] = useState<ProjectionCase[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePlan = (updater: (current: Plan) => Plan) => {
    setPlan((previous) => preparePlan(updater(previous)));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWarnings([]);
    const timer = setTimeout(() => {
      runProjection(plan)
        .then(({ cases, warnings }) => {
          if (cancelled) return;
          setResults(cases);
          setWarnings(warnings);
        })
        .catch((err) => {
          if (cancelled) return;
          setResults([]);
          setWarnings([]);
          if (axios.isAxiosError(err)) {
            const details = err.response?.data;
            const message =
              extractValidationMessage(details?.detail) ??
              extractValidationMessage(details?.error);
            if (message) {
              setError(message);
              return;
            }
          }
          setError(err instanceof Error ? err.message : "something went wrong");
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [plan]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight">Detailed Compound Interest Calculator</p>
            <p className="text-xs text-slate-500">Plan, compare, and project with multiple growth cases.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              Home
            </button>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              Calculator
            </button>
          </div>
        </nav>

        <div className="mt-10 grid gap-8 lg:grid-cols-[380px,1fr] lg:items-start">
          <div className="space-y-6">
            <InputWizard plan={plan} onPlanChange={updatePlan} />
            <DetailedPlanningPanel plan={plan} onPlanChange={updatePlan} disabled={loading} />
          </div>
          <ChartPanel cases={results} warnings={warnings} loading={loading} error={error} />
        </div>

        <footer className="mt-12 text-xs text-slate-500">
          <p>Educational illustration only. Adapt the assumptions to match your financial plan.</p>
        </footer>
      </div>
    </div>
  );
}
