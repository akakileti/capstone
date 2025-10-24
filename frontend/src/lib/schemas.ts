import { z } from "zod";

const age = z.number().int().min(10).max(110);

export const contributionRowSchema = z.object({
  fromAge: age,
  base: z.number().min(0),
  growthRate: z.number().min(-0.5).max(1).default(0),
  years: z.number().int().min(1).max(80).optional(),
});

export const growthOverrideRowSchema = z.object({
  fromAge: age,
  rate: z.number().min(-0.5).max(1),
  years: z.number().int().min(1).max(80).optional(),
});

export const scenarioSchema = z.object({
  kind: z.enum(["min", "avg", "max"]),
  nominalRate: z.number(),
});

export const accountSchema = z.object({
  label: z.string().min(1),
  note: z.string().trim().optional().default(""),
  initialBalance: z.number().min(0),
  contributions: z.array(contributionRowSchema).default([]),
  growthOverrides: z.array(growthOverrideRowSchema).default([]),
});

export const spendingRowSchema = z.object({
  fromAge: age,
  annualSpending: z.number().min(0),
  years: z.number().int().min(1).max(80).optional(),
});

export const planSchema = z.object({
  startAge: z.number().int().min(18).max(80),
  retireAge: z.number().int().min(25).max(110),
  inflationRate: z.number().min(0).max(0.2),
  inflationMargin: z.number().min(0).max(0.2),
  investmentGrowthRate: z.number().min(-0.5).max(1),
  investmentGrowthMargin: z.number().min(0).max(0.5),
  // Legacy fields kept for backward compatibility (not used in new UI)
  initialBalance: z.number().min(0).optional().default(0),
  annualContribution: z.number().min(0).optional().default(0),
  nominalGrowthRate: z.number().min(-0.5).max(1).optional(),
  startingRetirementSpending: z.number().min(0).optional().default(0),
  accounts: z.array(accountSchema).default([]),
  spendingSchedule: z.array(spendingRowSchema).default([]),
  scenarios: z.array(scenarioSchema).default([]),
});

export type ContributionRow = z.infer<typeof contributionRowSchema>;
export type GrowthOverrideRow = z.infer<typeof growthOverrideRowSchema>;
export type Account = z.infer<typeof accountSchema>;
export type SpendingRow = z.infer<typeof spendingRowSchema>;
export type GrowthScenario = z.infer<typeof scenarioSchema>;
export type Plan = z.infer<typeof planSchema>;

const defaultContribution: ContributionRow = {
  fromAge: 30,
  base: 6000,
  growthRate: 0.03,
  years: 35,
};

const defaultAccount: Account = {
  label: "401(k)",
  note: "",
  initialBalance: 25_000,
  contributions: [defaultContribution],
  growthOverrides: [],
};

const defaultSpendingRow: SpendingRow = {
  fromAge: 65,
  annualSpending: 40_000,
  years: 25,
};

export const defaultPlan: Plan = {
  startAge: 30,
  retireAge: 65,
  inflationRate: 0.03,
  inflationMargin: 0.02,
  investmentGrowthRate: 0.06,
  investmentGrowthMargin: 0.02,
  initialBalance: defaultAccount.initialBalance,
  annualContribution: defaultContribution.base,
  nominalGrowthRate: 0.06,
  startingRetirementSpending: defaultSpendingRow.annualSpending,
  accounts: [defaultAccount],
  spendingSchedule: [defaultSpendingRow],
  scenarios: [
    { kind: "min", nominalRate: 0.04 },
    { kind: "avg", nominalRate: 0.06 },
    { kind: "max", nominalRate: 0.08 },
  ],
};
