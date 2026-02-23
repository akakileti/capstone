import { useEffect, useState } from "react";

import axios from "axios";

import { ChartPanel } from "../components/ChartPanel";
import { DetailedPlanningPanel } from "../components/DetailedPlanningPanel";
import { ExportCard } from "../components/ExportCard";
import { InputWizard } from "../components/InputWizard";
import { API_CONFIG_ERROR } from "../lib/apiBase";
import { runProjection, type ProjectionRow } from "../lib/api";
import { type ProjectionCase } from "../lib/calc";
import { defaultPlan, type Account, type Plan } from "../lib/schemas";

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

  const derivedYears = Math.max(plan.retireAge - plan.startAge, 1);

  if (accounts.length === 0) {
    accounts = [
      {
        label: "General",
        note: "",
        initialBalance: baseInitial,
        taxTreatment: "none",
        taxRate: 0,
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
  } else {
    const primary = accounts[0];
    const looksAuto =
      accounts.length === 1 &&
      primary.growthOverrides.length === 0 &&
      primary.contributions.length <= 1;

    if (looksAuto) {
      const base = primary.contributions[0]?.base ?? plan.annualContribution ?? 0;
      const growthRate = primary.contributions[0]?.growthRate ?? 0;
      const contributions =
        base > 0
          ? [
              {
                fromAge: plan.startAge,
                base,
                growthRate,
                years: derivedYears,
              },
            ]
          : [];

      accounts = [
        {
          ...primary,
          taxTreatment: primary.taxTreatment ?? "none",
          taxRate: primary.taxRate ?? 0,
          contributions,
        },
      ];
    }
  }

  const updatedAccounts = accounts.map((account, index) => ({
    ...account,
    initialBalance: index === 0 ? baseInitial : account.initialBalance ?? 0,
    taxTreatment: account.taxTreatment ?? "none",
    taxRate: account.taxRate ?? 0,
  }));

  return {
    ...plan,
    initialBalance: baseInitial,
    accounts: updatedAccounts,
  };
};

const ensureSpending = (plan: Plan): Plan => {
  const schedule = plan.spendingSchedule.slice().sort((a, b) => a.fromAge - b.fromAge);
  const looksAuto = schedule.length <= 1;
  const defaultYears = computeDefaultSpendingYears(plan.retireAge);

  let normalized = schedule;

  if (looksAuto) {
    normalized =
      plan.startingRetirementSpending > 0
        ? [
            {
              fromAge: plan.retireAge,
              annualSpending: plan.startingRetirementSpending,
              years: defaultYears,
            },
          ]
        : [];
  } else {
    const retireIndex = schedule.findIndex((row) => row.fromAge === plan.retireAge);

    if (plan.startingRetirementSpending > 0) {
      if (retireIndex >= 0) {
        normalized[retireIndex] = {
          ...normalized[retireIndex],
          annualSpending: plan.startingRetirementSpending,
        };
      } else {
        normalized.push({
          fromAge: plan.retireAge,
          annualSpending: plan.startingRetirementSpending,
          years: defaultYears,
        });
      }
    } else if (retireIndex >= 0) {
      normalized.splice(retireIndex, 1);
    }
  }

  const retireRow = normalized.find((row) => row.fromAge === plan.retireAge);

  return {
    ...plan,
    startingRetirementSpending: retireRow ? retireRow.annualSpending : 0,
    spendingSchedule: normalized,
  };
};

const computeDefaultSpendingYears = (retireAge: number): number => {
  const targetEnd = retireAge >= 85 ? retireAge + 10 : 85;
  return Math.max(targetEnd - retireAge, 1);
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

export function CalculatorPage() {
  const [plan, setPlan] = useState<Plan>(() => preparePlan(defaultPlan));
  const [results, setResults] = useState<ProjectionCase[]>([]);
  const [projectionRows, setProjectionRows] = useState<ProjectionRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePlan = (updater: (current: Plan) => Plan) => {
    setPlan((previous) => preparePlan(updater(previous)));
  };

  useEffect(() => {
    let cancelled = false;

    if (API_CONFIG_ERROR) {
      setLoading(false);
      setError(API_CONFIG_ERROR);
      setResults([]);
      setProjectionRows([]);
      setWarnings([]);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    setWarnings([]);
    const timer = setTimeout(() => {
      runProjection(plan)
        .then(({ cases, warnings, rows }) => {
          if (cancelled) return;
          setResults(cases);
          setProjectionRows(rows);
          setWarnings(warnings);
        })
        .catch((err) => {
          if (cancelled) return;
          setResults([]);
          setProjectionRows([]);
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

  if (API_CONFIG_ERROR) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-red-700">Configuration error</h1>
        <p className="mt-3 text-sm text-slate-700">
          Backend URL is missing. Set <code>VITE_API_BASE_URL</code> in your environment and redeploy.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 grid gap-8 lg:grid-cols-[380px,1fr] lg:items-start">
        <div className="space-y-6">
          <InputWizard plan={plan} onPlanChange={updatePlan} />
          <DetailedPlanningPanel plan={plan} onPlanChange={updatePlan} disabled={loading} />
          <ExportCard plan={plan} rows={projectionRows} loading={loading} />
        </div>
        <ChartPanel cases={results} warnings={warnings} loading={loading} error={error} />
      </div>

      <footer className="mt-12 text-xs text-slate-500">
        <p>Educational illustration only. Adapt the assumptions to match your financial plan.</p>
      </footer>
    </>
  );
}

export default CalculatorPage;
