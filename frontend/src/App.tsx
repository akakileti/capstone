import { useEffect, useState } from "react";

import { ChartPanel } from "./components/ChartPanel";
import { DetailedPlanningPanel } from "./components/DetailedPlanningPanel";
import { InputWizard } from "./components/InputWizard";
import { runProjection } from "./lib/api";
import type { ProjectionCase } from "./lib/calc";
import { defaultPlan, type Account, type Plan, type SpendingRow } from "./lib/schemas";

const normalizePlan = (plan: Plan): Plan => {
  const totalInitial = plan.accounts.reduce((sum, account) => sum + account.initialBalance, 0);
  const earliestSpending = plan.spendingSchedule
    .slice()
    .sort((a, b) => a.fromAge - b.fromAge)[0];

  return {
    ...plan,
    initialBalance: totalInitial,
    startingRetirementSpending: earliestSpending?.annualSpending ?? plan.startingRetirementSpending ?? 0,
  };
};

const ensureDefaultAccount = (plan: Plan): Plan => {
  if (plan.accounts.length > 0) {
    return plan;
  }

  const account: Account = {
    label: "General",
    note: "",
    initialBalance: plan.initialBalance,
    contributions: [
      {
        fromAge: plan.startAge,
        base: plan.annualContribution ?? 0,
        growthRate: 0,
        years: Math.max(plan.retireAge - plan.startAge, 1),
      },
    ],
    growthOverrides: [],
  };

  return {
    ...plan,
    accounts: [account],
  };
};

const syncBasicInfoToSchedules = (plan: Plan): Plan => {
  const base = ensureDefaultAccount(plan);
  const otherTotal = base.accounts.slice(1).reduce((sum, account) => sum + account.initialBalance, 0);
  const firstBalance = Math.max(plan.initialBalance - otherTotal, 0);
  const accounts = base.accounts.map((account, index) =>
    index === 0 ? { ...account, initialBalance: firstBalance } : account,
  );

  let spendingSchedule: SpendingRow[];
  if (base.spendingSchedule.length === 0) {
    spendingSchedule = [
      {
        fromAge: base.retireAge,
        annualSpending: plan.startingRetirementSpending,
        years: 25,
      },
    ];
  } else {
    const sorted = base.spendingSchedule.slice().sort((a, b) => a.fromAge - b.fromAge);
    const existingIndex = sorted.findIndex((row) => row.fromAge === base.retireAge);
    if (existingIndex >= 0) {
      sorted[existingIndex] = {
        ...sorted[existingIndex],
        annualSpending: plan.startingRetirementSpending,
      };
    } else {
      sorted.push({
        fromAge: base.retireAge,
        annualSpending: plan.startingRetirementSpending,
        years: 25,
      });
      sorted.sort((a, b) => a.fromAge - b.fromAge);
    }
    spendingSchedule = sorted;
  }

  return normalizePlan({
    ...base,
    accounts,
    spendingSchedule,
  });
};

export default function App() {
  const [plan, setPlan] = useState<Plan>(syncBasicInfoToSchedules(defaultPlan));
  const [results, setResults] = useState<ProjectionCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPlan = async (nextPlan: Plan) => {
    setLoading(true);
    setError(null);
    try {
      const projection = await runProjection(nextPlan);
      setResults(projection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (updated: Plan) => {
    const merged = syncBasicInfoToSchedules({ ...plan, ...updated });
    setPlan(merged);
    await runPlan(merged);
  };

  const handlePlanChange = (updater: (current: Plan) => Plan) => {
    setPlan((previous) => {
      const next = normalizePlan(updater(previous));
      void runPlan(next);
      return next;
    });
  };

  useEffect(() => {
    void runPlan(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        <div className="mt-10 grid gap-8 lg:grid-cols-[380px,1fr]">
          <div className="space-y-6">
            <InputWizard plan={plan} onSubmit={handlePlanSubmit} loading={loading} />
            <DetailedPlanningPanel plan={plan} onPlanChange={handlePlanChange} disabled={loading} />
          </div>
          <ChartPanel cases={results} loading={loading} error={error} />
        </div>

        <footer className="mt-12 text-xs text-slate-500">
          <p>Educational illustration only. Adapt the assumptions to match your financial plan.</p>
        </footer>
      </div>
    </div>
  );
}
