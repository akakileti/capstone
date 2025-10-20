import { useMemo, useState } from "react";

import { formatCurrency } from "../lib/calc";
import { formatPercentage } from "../lib/number-format";
import type { Account, Plan, SpendingRow } from "../lib/schemas";

import { RetirementSpendingModal } from "./RetirementSpendingModal";
import { SavingsProgressionModal } from "./SavingsProgressionModal";

interface DetailedPlanningPanelProps {
  plan: Plan;
  onPlanChange: (updater: (plan: Plan) => Plan) => void | Promise<void>;
  disabled?: boolean;
}

export function DetailedPlanningPanel({ plan, onPlanChange, disabled = false }: DetailedPlanningPanelProps) {
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showSpendingModal, setShowSpendingModal] = useState(false);

  const accountSummary = useMemo(() => summarizeAccounts(plan.accounts, plan.retireAge), [plan.accounts, plan.retireAge]);
  const spendingSummary = useMemo(
    () => summarizeSpending(plan.spendingSchedule, plan.startAge, plan.inflationRate),
    [plan.spendingSchedule, plan.startAge, plan.inflationRate],
  );

  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Detailed Planning</h2>
        <p className="text-xs text-slate-500">
          Configure multi-year savings schedules, account growth overrides, and retirement spending.
        </p>
      </header>

      <div className="space-y-5">
        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"
            onClick={() => setShowSavingsModal(true)}
            disabled={disabled}
          >
            Edit Savings Progression
          </button>
          <SummaryList items={accountSummary} emptyLabel="No account schedules yet." />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"
            onClick={() => setShowSpendingModal(true)}
            disabled={disabled}
          >
            Edit Yearly Retirement Spending
          </button>
          <SummaryList items={spendingSummary} emptyLabel="Spending will default to $0 after retirement." />
        </div>
      </div>

      {showSavingsModal ? (
        <SavingsProgressionModal
          plan={plan}
          onClose={() => setShowSavingsModal(false)}
          onSave={(accounts) => {
            Promise.resolve(
              onPlanChange((current) => ({
                ...current,
                accounts,
              })),
            ).finally(() => setShowSavingsModal(false));
          }}
        />
      ) : null}

      {showSpendingModal ? (
        <RetirementSpendingModal
          plan={plan}
          onClose={() => setShowSpendingModal(false)}
          onSave={(schedule) => {
            Promise.resolve(
              onPlanChange((current) => ({
                ...current,
                spendingSchedule: schedule,
              })),
            ).finally(() => setShowSpendingModal(false));
          }}
        />
      ) : null}
    </section>
  );
}

function SummaryList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2 text-xs text-slate-600">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-2xl border border-slate-200 px-4 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function summarizeAccounts(accounts: Account[], retireAge: number): string[] {
  if (!accounts.length) return [];

  return accounts.map((account) => {
    if (!account.contributions.length) {
      return `${account.label}: no scheduled contributions`;
    }

    const rows = [...account.contributions].sort((a, b) => a.fromAge - b.fromAge);
    const first = rows[0];
    const last = rows[rows.length - 1];
    const endAge = last.years ? last.fromAge + last.years : retireAge;

    const baseSummary = `${formatCurrency(first.base)} / yr`;
    const growthSummary =
      first.growthRate !== 0 ? `, grows ${formatPercentage(first.growthRate)} / yr` : ", flat";
    const breakpointSummary = rows.length > 1 ? ` (${rows.length} breakpoints)` : "";

    return `${account.label}: ${baseSummary}${growthSummary} → age ${endAge}${breakpointSummary}`;
  });
}

function summarizeSpending(rows: SpendingRow[], startAge: number, inflationRate: number): string[] {
  if (!rows.length) return [];

  return rows
    .slice()
    .sort((a, b) => a.fromAge - b.fromAge)
    .map((row) => {
      const endAge = row.years ? row.fromAge + row.years : undefined;
      const yearsAhead = Math.max(row.fromAge - startAge, 0);
      const futureValue = row.annualSpending * Math.pow(1 + inflationRate, yearsAhead);
      const rangeLabel = endAge ? `Age ${row.fromAge}-${endAge}` : `Age ${row.fromAge}+`;
      return `${rangeLabel}: ${formatCurrency(row.annualSpending)} / yr today ≈ ${formatCurrency(futureValue)} nominal`;
    });
}
