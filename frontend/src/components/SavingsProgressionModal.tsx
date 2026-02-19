import { createPortal } from "react-dom";
import { useMemo, useState } from "react";

import { formatCurrency } from "../lib/calc";
import { createId } from "../lib/ids";
import {
  accountSchema,
  type Account,
  type ContributionRow,
  type GrowthOverrideRow,
  type Plan,
} from "../lib/schemas";
import type { IntervalIssue } from "../lib/schedules";
import {
  computeEndAge,
  expandContributionByAge,
  validateIntervals,
} from "../lib/schedules";

import { ModalShell } from "./modal/ModalShell";

interface SavingsProgressionModalProps {
  plan: Plan;
  onClose: () => void;
  onSave: (accounts: Account[]) => void;
}

interface EditableContributionRow extends ContributionRow {
  id: string;
}

interface EditableGrowthRow extends GrowthOverrideRow {
  id: string;
}

interface EditableAccount extends Account {
  id: string;
  contributions: EditableContributionRow[];
  growthOverrides: EditableGrowthRow[];
}

interface AccountDiagnostics {
  accountId: string;
  contributionSorted: EditableContributionRow[];
  growthSorted: EditableGrowthRow[];
  contributionMap: Map<string, IntervalIssue[]>;
  growthMap: Map<string, IntervalIssue[]>;
  blockingError: boolean;
}

const sortByAge = <T extends { fromAge: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.fromAge - b.fromAge);

export function SavingsProgressionModal({ plan, onClose, onSave }: SavingsProgressionModalProps) {
  if (typeof document === "undefined") return null;

  const [accounts, setAccounts] = useState<EditableAccount[]>(() =>
    plan.accounts.length ? plan.accounts.map(toEditableAccount) : [createBlankAccount(plan)],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const accountDiagnostics: AccountDiagnostics[] = useMemo(() => {
    return accounts.map((account) => {
      const contributionSorted = sortByAge(account.contributions);
      const growthSorted = sortByAge(account.growthOverrides);

      const contributionIssues = validateIntervals(
        contributionSorted.map(stripId),
        plan.retireAge,
      );
      const growthIssues = validateIntervals(growthSorted.map(stripGrowthId), plan.retireAge);

      return {
        accountId: account.id,
        contributionSorted,
        growthSorted,
        contributionMap: mapIssuesToRows(contributionSorted, contributionIssues),
        growthMap: mapIssuesToRows(growthSorted, growthIssues),
        blockingError:
          contributionIssues.some((issue) => issue.severity === "error") ||
          growthIssues.some((issue) => issue.severity === "error"),
      };
    });
  }, [accounts, plan.retireAge]);

  const hasBlockingErrors = accountDiagnostics.some((diag) => diag.blockingError);

  const handleAccountChange = (id: string, updater: (account: EditableAccount) => EditableAccount) => {
    setAccounts((existing) =>
      existing.map((account) => (account.id === id ? sortAccount(updater(account)) : account)),
    );
  };

  const handleAddAccount = () => {
    setAccounts((prev) => [...prev, createBlankAccount(plan, prev.length + 1)]);
  };

  const handleRemoveAccount = (accountId: string) => {
    setAccounts((prev) => prev.filter((account) => account.id !== accountId));
  };

  const handleSave = () => {
    setFormError(null);
    try {
      const sanitized = accounts.map((account) =>
        accountSchema.parse({
          label: account.label.trim() || "New Account",
          note: account.note?.trim() ?? "",
          initialBalance: account.initialBalance,
          taxTreatment: account.taxTreatment,
          taxRate: account.taxRate ?? 0,
          contributions: sortByAge(account.contributions).map(stripId),
          growthOverrides: sortByAge(account.growthOverrides).map(stripGrowthId),
        }),
      );

      onSave(sanitized);
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("Unable to save accounts. Check the inputs and try again.");
      }
    }
  };

  return createPortal(
    <ModalShell
      title="Edit Savings Progression"
      description="Add accounts, set breakpoints, and control growth overrides."
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel="Save changes"
      confirmDisabled={hasBlockingErrors}
      errorMessage={formError}
    >
      <div className="space-y-6">
        {accounts.map((account) => {
          const diagnostics = accountDiagnostics.find((diag) => diag.accountId === account.id);
          const contributionsTotal = calculateAccountTotal(account, plan.startAge, plan.retireAge);
          return (
            <AccountEditor
              key={account.id}
              plan={plan}
              account={account}
              diagnostics={diagnostics}
              onChange={(updater) => handleAccountChange(account.id, updater)}
              onRemove={() => handleRemoveAccount(account.id)}
              canRemove={accounts.length > 1}
              contributionsTotal={contributionsTotal}
            />
          );
        })}

        <button
          type="button"
          className="w-full rounded-2xl border border-dashed border-slate-400 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
          onClick={handleAddAccount}
        >
          + Add Account
        </button>
      </div>
    </ModalShell>,
    document.body,
  );
}

function AccountEditor({
  plan,
  account,
  onChange,
  onRemove,
  diagnostics,
  canRemove,
  contributionsTotal,
}: {
  plan: Plan;
  account: EditableAccount;
  onChange: (updater: (account: EditableAccount) => EditableAccount) => void;
  onRemove: () => void;
  canRemove: boolean;
  diagnostics?: AccountDiagnostics;
  contributionsTotal: number;
}) {
  const removeDisabled = !canRemove;

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
              value={account.label}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Account name"
            />
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-40"
              onClick={onRemove}
              disabled={removeDisabled}
            >
              Remove
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs text-slate-500">
              Initial balance
              <input
                className="mt-1 w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
                type="number"
                step="100"
                value={account.initialBalance}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    initialBalance: Number(event.target.value) || 0,
                  }))
                }
              />
            </label>
            <p className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Total scheduled contributions: {formatCurrency(contributionsTotal)} by age {plan.retireAge}
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tax treatment</p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4 text-slate-700"
                  checked={account.taxTreatment === "none"}
                  onChange={() =>
                    onChange((current) => ({
                      ...current,
                      taxTreatment: "none",
                    }))
                  }
                />
                <span className="font-medium">No tax</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4 text-slate-700"
                  checked={account.taxTreatment === "entry"}
                  onChange={() =>
                    onChange((current) => ({
                      ...current,
                      taxTreatment: "entry",
                    }))
                  }
                />
                <span className="font-medium">Tax on entry (Roth-style)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4 text-slate-700"
                  checked={account.taxTreatment === "growth"}
                  onChange={() =>
                    onChange((current) => ({
                      ...current,
                      taxTreatment: "growth",
                    }))
                  }
                />
                <span className="font-medium">Tax on gains (brokerage)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4 text-slate-700"
                  checked={account.taxTreatment === "exit"}
                  onChange={() =>
                    onChange((current) => ({
                      ...current,
                      taxTreatment: "exit",
                    }))
                  }
                />
                <span className="font-medium">Tax on withdrawal (401k-style)</span>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px,1fr] sm:items-end">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Per-account tax rate (decimal)
                <input
                  className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60 sm:w-32"
                  type="number"
                  step="0.001"
                  value={account.taxRate ?? 0}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      taxRate: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Applied when {labelTax(account.taxTreatment)}.
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Contribution schedule</h3>
        <ContributionTable
          plan={plan}
          account={account}
          diagnostics={diagnostics}
          onChange={onChange}
        />
      </section>

      <section className="mt-4 space-y-3">
        <h4 className="text-sm font-semibold text-slate-700">Growth adjustments (optional)</h4>
        <p className="text-xs text-slate-500">
          These adjustments let you override the base growth assumptions for specific years. Leave this empty
          unless you expect this account to consistently outperform or lag the global growth rate.
        </p>
        <GrowthOverrideTable
          plan={plan}
          account={account}
          diagnostics={diagnostics}
          onChange={onChange}
        />
      </section>
    </section>
  );
}

function ContributionTable({
  plan,
  account,
  diagnostics,
  onChange,
}: {
  plan: Plan;
  account: EditableAccount;
  diagnostics?: AccountDiagnostics;
  onChange: (updater: (account: EditableAccount) => EditableAccount) => void;
}) {
  const rows = diagnostics?.contributionSorted ?? sortByAge(account.contributions);
  const issueMap = diagnostics?.contributionMap ?? new Map<string, IntervalIssue[]>();

  const handleUpdateRow = (rowId: string, updater: (row: EditableContributionRow) => EditableContributionRow) => {
    onChange((current) => ({
      ...current,
      contributions: sortByAge(
        current.contributions.map((row) => (row.id === rowId ? updater({ ...row }) : row)),
      ),
    }));
  };

  const handleAddRowAfter = (rowId: string) => {
    onChange((current) => {
      const sorted = sortByAge(current.contributions);
      const index = sorted.findIndex((row) => row.id === rowId);
      const reference = sorted[index];
      const next = sorted[index + 1];
      const fromAge = Math.min(
        computeEndAge(reference, next?.fromAge, plan.retireAge),
        plan.retireAge,
      );
      const newRow: EditableContributionRow = {
        id: createId("ctr"),
        fromAge,
        base: reference.base,
        growthRate: reference.growthRate,
        years: reference.years,
      };
      return {
        ...current,
        contributions: sortByAge([...current.contributions, newRow]),
      };
    });
  };

  const handleDuplicateRow = (rowId: string) => {
    onChange((current) => {
      const row = current.contributions.find((candidate) => candidate.id === rowId);
      if (!row) return current;
      const duplicate: EditableContributionRow = {
        ...row,
        id: createId("ctr"),
        fromAge: row.fromAge,
      };
      return {
        ...current,
        contributions: sortByAge([...current.contributions, duplicate]),
      };
    });
  };

  const handleDeleteRow = (rowId: string) => {
    onChange((current) => ({
      ...current,
      contributions: current.contributions.filter((row) => row.id !== rowId),
    }));
  };

  const handleAddBreakpoint = () => {
    onChange((current) => {
      const sorted = sortByAge(current.contributions);
      const last = sorted[sorted.length - 1];
      const fromAge =
        last && last.years
          ? last.fromAge + last.years
          : last
          ? Math.min(last.fromAge + 1, plan.retireAge)
          : plan.startAge;

      const newRow: EditableContributionRow = {
        id: createId("ctr"),
        fromAge,
        base: last?.base ?? 0,
        growthRate: last?.growthRate ?? 0,
        years: last?.years,
      };

      return {
        ...current,
        contributions: sortByAge([...current.contributions, newRow]),
      };
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">From age</th>
            <th className="px-3 py-2 text-left font-semibold">Base contribution</th>
            <th className="px-3 py-2 text-left font-semibold">Annual growth</th>
            <th className="px-3 py-2 text-left font-semibold">Years</th>
            <th className="px-3 py-2 text-left font-semibold">Estimated end age</th>
            <th className="px-3 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {rows.map((row, index) => {
            const next = rows[index + 1];
            const endAge = computeEndAge(row, next?.fromAge, plan.retireAge);
            const issues = issueMap.get(row.id);
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    value={row.fromAge}
                    onChange={(event) =>
                      handleUpdateRow(row.id, (current) => ({
                        ...current,
                        fromAge: Number(event.target.value) || plan.startAge,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    step="100"
                    value={row.base}
                    onChange={(event) =>
                      handleUpdateRow(row.id, (current) => ({
                        ...current,
                        base: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    step="0.01"
                    value={row.growthRate}
                    onChange={(event) =>
                      handleUpdateRow(row.id, (current) => ({
                        ...current,
                        growthRate: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    min={1}
                    value={row.years ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleUpdateRow(row.id, (current) => ({
                        ...current,
                        years: value === "" ? undefined : Number(value),
                      }));
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-slate-500">{endAge}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2 text-xs">
                    <IconButton label="Add after" onClick={() => handleAddRowAfter(row.id)}>
                      +
                    </IconButton>
                    <IconButton label="Duplicate" onClick={() => handleDuplicateRow(row.id)}>
                      ⧉
                    </IconButton>
                    <IconButton label="Delete" onClick={() => handleDeleteRow(row.id)}>
                      🗑
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-slate-200 bg-slate-50 p-2 text-right">
        <button
          type="button"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
          onClick={handleAddBreakpoint}
        >
          + Add Breakpoint
        </button>
      </div>

      {rows.map((row) => {
        const issues = (issueMap.get(row.id) ?? []).filter(Boolean);
        if (!issues.length) return null;
        return (
          <div key={`${row.id}-issues`} className="border-t border-slate-200 bg-white px-4 py-2 text-xs">
            {issues.map((issue, index) => (
              <p
                key={index}
                className={issue.severity === "error" ? "text-red-600" : "text-amber-600"}
              >
                {issue.message}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GrowthOverrideTable({
  plan,
  account,
  diagnostics,
  onChange,
}: {
  plan: Plan;
  account: EditableAccount;
  diagnostics?: AccountDiagnostics;
  onChange: (updater: (account: EditableAccount) => EditableAccount) => void;
}) {
  const rows = diagnostics?.growthSorted ?? sortByAge(account.growthOverrides);
  const issueMap = diagnostics?.growthMap ?? new Map<string, IntervalIssue[]>();

  const updateRow = (rowId: string, updater: (row: EditableGrowthRow) => EditableGrowthRow) => {
    onChange((current) => ({
      ...current,
      growthOverrides: sortByAge(
        current.growthOverrides.map((row) => (row.id === rowId ? updater({ ...row }) : row)),
      ),
    }));
  };

  const addRowAfter = (rowId: string) => {
    onChange((current) => {
      const sorted = sortByAge(current.growthOverrides);
      const index = sorted.findIndex((row) => row.id === rowId);
      const reference = sorted[index];
      const next = sorted[index + 1];
      const fromAge = Math.min(
        computeEndAge(reference, next?.fromAge, plan.retireAge),
        plan.retireAge,
      );
      const newRow: EditableGrowthRow = {
        id: createId("grw"),
        fromAge,
        rate: reference.rate,
        years: reference.years,
      };
      return {
        ...current,
        growthOverrides: sortByAge([...current.growthOverrides, newRow]),
      };
    });
  };

  const duplicateRow = (rowId: string) => {
    onChange((current) => {
      const row = current.growthOverrides.find((candidate) => candidate.id === rowId);
      if (!row) return current;
      const duplicate: EditableGrowthRow = {
        ...row,
        id: createId("grw"),
      };
      return {
        ...current,
        growthOverrides: sortByAge([...current.growthOverrides, duplicate]),
      };
    });
  };

  const deleteRow = (rowId: string) => {
    onChange((current) => ({
      ...current,
      growthOverrides: current.growthOverrides.filter((row) => row.id !== rowId),
    }));
  };

  const addOverride = () => {
    onChange((current) => {
      const sorted = sortByAge(current.growthOverrides);
      const last = sorted[sorted.length - 1];
      const fromAge = last ? Math.min(last.fromAge + (last.years ?? 1), plan.retireAge) : plan.startAge;
      const newRow: EditableGrowthRow = {
        id: createId("grw"),
        fromAge,
        rate: plan.investmentGrowthRate,
        years: last?.years,
      };
      return {
        ...current,
        growthOverrides: sortByAge([...current.growthOverrides, newRow]),
      };
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">From age</th>
            <th className="px-3 py-2 text-left font-semibold">Nominal growth rate</th>
            <th className="px-3 py-2 text-left font-semibold">Years</th>
            <th className="px-3 py-2 text-left font-semibold">Estimated end age</th>
            <th className="px-3 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {rows.map((row, index) => {
            const next = rows[index + 1];
            const endAge = computeEndAge(row, next?.fromAge, plan.retireAge);
            const issues = issueMap.get(row.id);
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    value={row.fromAge}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        fromAge: Number(event.target.value) || plan.startAge,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    step="0.01"
                    value={row.rate}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        rate: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                    type="number"
                    value={row.years ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateRow(row.id, (current) => ({
                        ...current,
                        years: value === "" ? undefined : Number(value),
                      }));
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-slate-500">{endAge}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2 text-xs">
                    <IconButton label="Add after" onClick={() => addRowAfter(row.id)}>
                      +
                    </IconButton>
                    <IconButton label="Duplicate" onClick={() => duplicateRow(row.id)}>
                      ⧉
                    </IconButton>
                    <IconButton label="Delete" onClick={() => deleteRow(row.id)}>
                      🗑
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-slate-200 bg-slate-50 p-2 text-right">
        <button
          type="button"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
          onClick={addOverride}
        >
          + Add Override
        </button>
      </div>

      {rows.map((row) => {
        const issues = issueMap.get(row.id) ?? [];
        if (!issues.length) return null;
        return (
          <div key={`${row.id}-issues`} className="border-t border-slate-200 bg-white px-4 py-2 text-xs">
            {issues.map((issue, index) => (
              <p
                key={index}
                className={issue.severity === "error" ? "text-red-600" : "text-amber-600"}
              >
                {issue.message}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function calculateAccountTotal(account: Account, startAge: number, retireAge: number) {
  const schedule = expandContributionByAge(account.contributions, startAge, retireAge);
  let total = 0;
  schedule.forEach((value) => {
    total += value;
  });
  return total;
}

function toEditableAccount(account: Account): EditableAccount {
  return {
    ...account,
    id: createId("acct"),
    note: account.note ?? "",
    taxTreatment: account.taxTreatment ?? "none",
    taxRate: account.taxRate ?? 0,
    contributions: account.contributions.map((row) => ({ ...row, id: createId("ctr") })),
    growthOverrides: account.growthOverrides.map((row) => ({ ...row, id: createId("grw") })),
  };
}

function stripId(row: EditableContributionRow): ContributionRow {
  const { id: _id, ...rest } = row;
  return rest;
}

function stripGrowthId(row: EditableGrowthRow): GrowthOverrideRow {
  const { id: _id, ...rest } = row;
  return rest;
}

function createBlankAccount(plan: Plan, index = 1): EditableAccount {
  const baseRow: EditableContributionRow = {
    id: createId("ctr"),
    fromAge: plan.startAge,
    base: 0,
    growthRate: 0,
    years: Math.max(plan.retireAge - plan.startAge, 1),
  };

  return {
    id: createId("acct"),
    label: `Account ${index}`,
    note: "",
    initialBalance: 0,
    taxTreatment: "none",
    taxRate: 0,
    contributions: [baseRow],
    growthOverrides: [],
  };
}

function mapIssuesToRows<T extends { id: string; fromAge: number }>(
  rows: T[],
  issues: IntervalIssue[],
) {
  const map = new Map<string, IntervalIssue[]>();
  issues.forEach((issue) => {
    const row = rows[issue.index];
    if (!row) return;
    const existing = map.get(row.id) ?? [];
    existing.push(issue);
    map.set(row.id, existing);
  });
  return map;
}

function sortAccount(account: EditableAccount): EditableAccount {
  return {
    ...account,
    contributions: sortByAge(account.contributions),
    growthOverrides: sortByAge(account.growthOverrides),
  };
}

function labelTax(treatment: Account["taxTreatment"]): string {
  switch (treatment) {
    case "entry":
      return "taxed on contributions";
    case "growth":
      return "taxed on gains";
    case "exit":
      return "taxed on withdrawals";
    default:
      return "no tax";
  }
}
