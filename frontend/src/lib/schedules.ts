import type {
  Account,
  ContributionRow,
  GrowthOverrideRow,
  Plan,
  SpendingRow,
} from "./schemas";

export interface AnnotatedRow {
  index: number;
  fromAge: number;
  years?: number;
  endAge: number;
  message?: string;
  severity?: "warning" | "error";
}

export interface IntervalIssue {
  index: number;
  message: string;
  severity: "warning" | "error";
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function computeEndAge(
  row: { fromAge: number; years?: number },
  nextFromAge: number | undefined,
  fallbackEnd: number,
): number {
  if (row.years && row.years > 0) {
    return row.fromAge + row.years;
  }
  if (nextFromAge && nextFromAge > row.fromAge) {
    return nextFromAge;
  }
  return fallbackEnd;
}

export function validateIntervals(
  rows: ContributionRow[] | GrowthOverrideRow[] | SpendingRow[],
  fallbackEnd: number,
): IntervalIssue[] {
  const sorted = [...rows].sort((a, b) => a.fromAge - b.fromAge);
  const issues: IntervalIssue[] = [];

  sorted.forEach((row, index) => {
    const next = sorted[index + 1];
    const endAge = computeEndAge(row, next?.fromAge, fallbackEnd);

    if (endAge <= row.fromAge) {
      issues.push({
        index,
        message: `Overlap detected at age ${row.fromAge}. Adjust the years or the next breakpoint.`,
        severity: "error",
      });
    } else if (next && next.fromAge > endAge) {
      issues.push({
        index,
        message: `Gap detected between ages ${endAge} and ${next.fromAge}.`,
        severity: "warning",
      });
    } else if (next && next.fromAge < endAge) {
      issues.push({
        index,
        message: `Overlap detected between ages ${next.fromAge} and ${endAge}.`,
        severity: "error",
      });
    }
  });

  return issues;
}

export function expandContributionByAge(
  rows: ContributionRow[],
  startAge: number,
  endAge: number,
): Map<number, number> {
  const sorted = [...rows].sort((a, b) => a.fromAge - b.fromAge);
  const schedule = new Map<number, number>();

  sorted.forEach((row, index) => {
    const next = sorted[index + 1];
    const seriesEnd = computeEndAge(row, next?.fromAge, endAge);
    const duration = Math.max(seriesEnd - row.fromAge, 0);
    if (duration <= 0) {
      return;
    }

    let amount = row.base;
    for (let offset = 0; offset < duration; offset += 1) {
      const age = row.fromAge + offset;
      if (age < startAge || age > endAge) continue;
      const previous = schedule.get(age) ?? 0;
      schedule.set(age, previous + amount);
      amount *= 1 + row.growthRate;
    }
  });

  return schedule;
}

export function expandGrowthOverridesByAge(
  rows: GrowthOverrideRow[],
  startAge: number,
  endAge: number,
): Map<number, number> {
  const sorted = [...rows].sort((a, b) => a.fromAge - b.fromAge);
  const schedule = new Map<number, number>();

  sorted.forEach((row, index) => {
    const next = sorted[index + 1];
    const seriesEnd = computeEndAge(row, next?.fromAge, endAge);
    const duration = Math.max(seriesEnd - row.fromAge, 0);
    if (duration <= 0) {
      return;
    }

    for (let offset = 0; offset < duration; offset += 1) {
      const age = row.fromAge + offset;
      if (age < startAge || age > endAge) continue;
      schedule.set(age, row.rate);
    }
  });

  return schedule;
}

export function expandSpendingByAge(
  rows: SpendingRow[],
  startAge: number,
  endAge: number,
): Map<number, number> {
  const sorted = [...rows].sort((a, b) => a.fromAge - b.fromAge);
  const schedule = new Map<number, number>();

  sorted.forEach((row, index) => {
    const next = sorted[index + 1];
    const seriesEnd = computeEndAge(row, next?.fromAge, endAge);
    const duration = Math.max(seriesEnd - row.fromAge, 0);
    if (duration <= 0) {
      return;
    }

    for (let offset = 0; offset < duration; offset += 1) {
      const age = row.fromAge + offset;
      if (age < startAge || age > endAge) continue;
      schedule.set(age, row.annualSpending);
    }
  });

  return schedule;
}

export function fallbackAccounts(plan: Plan): Account[] {
  if (plan.accounts.length) return plan.accounts;

  return [
    {
      label: "General",
      taxTreatment: "none",
      taxRate: 0,
      note: "",
      initialBalance: plan.initialBalance ?? 0,
      contributions:
        plan.annualContribution && plan.annualContribution > 0
          ? [
              {
                fromAge: plan.startAge,
                base: plan.annualContribution,
                growthRate: 0,
                years: Math.max(plan.retireAge - plan.startAge, 1),
              },
            ]
          : [],
      growthOverrides: [],
    },
  ];
}

export function clampRate(value: number) {
  return clamp(value, -0.9, 1.5);
}
