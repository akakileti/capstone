import { createPortal } from "react-dom";
import { useMemo, useState } from "react";

import { formatCurrency } from "../lib/calc";
import { formatPercentage } from "../lib/number-format";
import { createId } from "../lib/ids";
import { spendingRowSchema, type Plan, type SpendingRow } from "../lib/schemas";
import type { IntervalIssue } from "../lib/schedules";
import { computeEndAge, validateIntervals, expandSpendingByAge } from "../lib/schedules";

import { ModalShell } from "./modal/ModalShell";

interface RetirementSpendingModalProps {
  plan: Plan;
  onClose: () => void;
  onSave: (rows: SpendingRow[]) => void;
}

interface EditableSpendingRow extends SpendingRow {
  id: string;
}

type IntervalMap = Map<string, IntervalIssue[]>;

const AFTER_RETIREMENT_PADDING = 35;

export function RetirementSpendingModal({ plan, onClose, onSave }: RetirementSpendingModalProps) {
  if (typeof document === "undefined") return null;

  const [rows, setRows] = useState<EditableSpendingRow[]>(() =>
    plan.spendingSchedule.length
      ? plan.spendingSchedule.map((row) => ({ ...row, id: createId("spn") }))
      : [createDefaultRow(plan)],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.fromAge - b.fromAge), [rows]);
  const issues = useMemo(
    () => validateIntervals(sortedRows.map(stripId), plan.retireAge + AFTER_RETIREMENT_PADDING),
    [sortedRows, plan.retireAge],
  );

  const issueMap: IntervalMap = useMemo(() => {
    const map: IntervalMap = new Map();
    issues.forEach((issue) => {
      const row = sortedRows[issue.index];
      if (!row) return;
      const list = map.get(row.id) ?? [];
      list.push(issue);
      map.set(row.id, list);
    });
    return map;
  }, [issues, sortedRows]);

  const hasBlockingErrors = issues.some((issue) => issue.severity === "error");
  const inflationRate = plan.inflationRate;
  const startAge = plan.startAge;

  const handleUpdateRow = (rowId: string, updater: (row: EditableSpendingRow) => EditableSpendingRow) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? updater({ ...row }) : row)),
    );
  };

  const handleAddRowAfter = (rowId: string) => {
    setRows((current) => {
      const sorted = [...current].sort((a, b) => a.fromAge - b.fromAge);
      const index = sorted.findIndex((row) => row.id === rowId);
      const reference = sorted[index];
      const next = sorted[index + 1];
      const fromAge = Math.min(
        computeEndAge(reference, next?.fromAge, plan.retireAge + AFTER_RETIREMENT_PADDING),
        plan.retireAge + AFTER_RETIREMENT_PADDING,
      );
      const newRow: EditableSpendingRow = {
        id: createId("spn"),
        fromAge,
        annualSpending: reference.annualSpending,
        years: reference.years,
      };
      return [...current, newRow];
    });
  };

  const handleDuplicateRow = (rowId: string) => {
    setRows((current) => {
      const candidate = current.find((row) => row.id === rowId);
      if (!candidate) return current;
      return [...current, { ...candidate, id: createId("spn") }];
    });
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const handleAddBreakpoint = () => {
    setRows((current) => {
      const sorted = [...current].sort((a, b) => a.fromAge - b.fromAge);
      const last = sorted[sorted.length - 1];
      const fromAge =
        last && last.years
          ? last.fromAge + last.years
          : last
          ? last.fromAge + 1
          : Math.max(plan.retireAge, plan.startAge);
      return [
        ...current,
        {
          id: createId("spn"),
          fromAge,
          annualSpending: last?.annualSpending ?? 0,
          years: last?.years,
        },
      ];
    });
  };

  const handleSave = () => {
    setFormError(null);
    try {
      const sanitized = sortedRows.map((row) => spendingRowSchema.parse(stripId(row)));
      onSave(sanitized);
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("Unable to save spending schedule. Double-check the entries and try again.");
      }
    }
  };

  const spendingTotal = useMemo(() => {
    const timeline = expandSpendingByAge(
      sortedRows.map(stripId),
      plan.retireAge,
      plan.retireAge + AFTER_RETIREMENT_PADDING,
    );
    let total = 0;
    timeline.forEach((value) => {
      total += value;
    });
    return total;
  }, [sortedRows, plan.retireAge]);

  return createPortal(
    <ModalShell
      title="Edit Retirement Spending Schedule"
      description="Define how much you plan to withdraw each year in retirement."
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel="Save changes"
      confirmDisabled={hasBlockingErrors}
      errorMessage={formError}
    >
      <p className="mb-4 text-xs text-slate-500">
        Spending starts at retirement age ({plan.retireAge}). Enter values in today&apos;s dollars—we display the
        inflated amount for each row so you know the nominal withdrawal you&apos;ll take at that age. Use
        breakpoints to step spending up or down, or leave Years blank to carry a row until the next breakpoint.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">From age</th>
              <th className="px-3 py-2 text-left font-semibold">Annual spending (USD)</th>
              <th className="px-3 py-2 text-left font-semibold">Nominal in that year</th>
              <th className="px-3 py-2 text-left font-semibold">Years</th>
              <th className="px-3 py-2 text-left font-semibold">Estimated end age</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedRows.map((row, index) => {
              const next = sortedRows[index + 1];
              const endAge = computeEndAge(row, next?.fromAge, plan.retireAge + AFTER_RETIREMENT_PADDING);
              const rowIssues = issueMap.get(row.id) ?? [];
              const yearsAhead = Math.max(row.fromAge - startAge, 0);
              const nominalValue = row.annualSpending * Math.pow(1 + inflationRate, yearsAhead);

              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1"
                      type="number"
                      value={row.fromAge}
                      onChange={(event) =>
                        handleUpdateRow(row.id, (current) => ({
                          ...current,
                          fromAge: Number(event.target.value) || plan.retireAge,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1"
                      type="number"
                      step="100"
                      value={row.annualSpending}
                      onChange={(event) =>
                        handleUpdateRow(row.id, (current) => ({
                          ...current,
                          annualSpending: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{formatCurrency(nominalValue)}</td>
                  <td className="px-3 py-2">
                    <input
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                      type="number"
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
                      <IconButton onClick={() => handleAddRowAfter(row.id)} label="Add after">
                        +
                      </IconButton>
                      <IconButton onClick={() => handleDuplicateRow(row.id)} label="Duplicate">
                        ⧉
                      </IconButton>
                      <IconButton onClick={() => handleDeleteRow(row.id)} label="Delete">
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

        {sortedRows.map((row) => {
          const rowIssues = issueMap.get(row.id) ?? [];
          if (!rowIssues.length) return null;
          return (
            <div key={`${row.id}-issues`} className="border-t border-slate-200 bg-white px-4 py-2 text-xs">
              {rowIssues.map((issue, index) => (
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p>
          Estimated withdrawals scheduled (today&apos;s dollars): {formatCurrency(spendingTotal)} over the next {AFTER_RETIREMENT_PADDING} years.
        </p>
        <p className="mt-1">
          Assuming {formatPercentage(inflationRate)} inflation, the first retirement-year withdrawal becomes approximately {formatCurrency(
            sortedRows.length
              ? sortedRows[0].annualSpending * Math.pow(1 + inflationRate, Math.max(sortedRows[0].fromAge - startAge, 0))
              : 0,
          )} in nominal dollars.
        </p>
      </div>
    </ModalShell>,
    document.body,
  );
}

function IconButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: string;
  label: string;
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

function stripId(row: EditableSpendingRow): SpendingRow {
  const { id: _id, ...rest } = row;
  return rest;
}

function createDefaultRow(plan: Plan): EditableSpendingRow {
  return {
    id: createId("spn"),
    fromAge: plan.retireAge,
    annualSpending: 40_000,
    years: 25,
  };
}
