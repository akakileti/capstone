import {
  clampRate,
  expandContributionByAge,
  expandGrowthOverridesByAge,
  expandSpendingByAge,
  fallbackAccounts,
} from "./schedules";
import type { Plan } from "./schemas";

export type YearPoint = {
  yearIndex: number;
  age: number;
  nominal: number;
  real: number;
};

export interface ProjectionCase {
  id: string;
  label: string;
  color: string;
  points: YearPoint[];
}

const CASE_CONFIG = [
  { id: "min", label: "Min", color: "#1d4ed8", growthAdjust: -1, inflationAdjust: 1 },
  { id: "avg", label: "Avg", color: "#dc2626", growthAdjust: 0, inflationAdjust: 0 },
  { id: "max", label: "Max", color: "#f59e0b", growthAdjust: 1, inflationAdjust: -1 },
];

export function projectBalances(plan: Plan): ProjectionCase[] {
  const { startAge, retireAge, investmentGrowthRate, investmentGrowthMargin, inflationRate, inflationMargin } =
    plan;

  const finalAge = Math.max(retireAge + 30, retireAge + Math.ceil(investmentGrowthMargin * 50));
  const span = Math.max(finalAge - startAge, 1);

  const accounts = fallbackAccounts(plan);
  const accountSchedules = accounts.map((account) => ({
    account,
    contributions: expandContributionByAge(account.contributions, startAge, finalAge),
    overrides: expandGrowthOverridesByAge(account.growthOverrides, startAge, finalAge),
  }));
  const spending = expandSpendingByAge(plan.spendingSchedule, startAge, finalAge);

  return CASE_CONFIG.map(({ id, label, color, growthAdjust, inflationAdjust }) => {
    const baselineRate = clampRate(investmentGrowthRate + growthAdjust * investmentGrowthMargin);
    const inflationCase = Math.max(inflationRate + inflationAdjust * inflationMargin, 0);

    const points: YearPoint[] = [];
    const balances = accountSchedules.map(({ account }) => account.initialBalance);
    let cumulativeInflationFactor = 1;

    for (let year = 0; year <= span; year += 1) {
      const age = startAge + year;

      // Contributions
      accountSchedules.forEach(({ contributions }, index) => {
        const amount = contributions.get(age) ?? 0;
        balances[index] += amount;
      });

      // Retirement spending (only kicks in once user hits retirement age)
      const spendingAmount = age >= retireAge ? spending.get(age) ?? 0 : 0;
      if (spendingAmount > 0) {
        const totalBeforeSpending = balances.reduce((sum, value) => sum + value, 0);
        if (totalBeforeSpending > 0) {
          let remaining = spendingAmount;
          balances.forEach((value, index) => {
            if (remaining <= 0) return;
            const share = (value / totalBeforeSpending) * spendingAmount;
            const withdrawal = Math.min(share, balances[index]);
            balances[index] -= withdrawal;
            remaining -= withdrawal;
          });
        }
      }

      // Growth
      accountSchedules.forEach(({ overrides }, index) => {
        const overrideRate = overrides.get(age);
        const rate = clampRate(overrideRate ?? baselineRate);
        balances[index] *= 1 + rate;
      });

      const nominal = balances.reduce((sum, balance) => sum + balance, 0);
      const real = nominal / cumulativeInflationFactor;

      points.push({
        yearIndex: year,
        age,
        nominal,
        real,
      });

      cumulativeInflationFactor *= 1 + inflationCase;
    }

    return { id, label, color, points };
  });
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
