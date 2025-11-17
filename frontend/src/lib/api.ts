import axios from "axios";

import { SCENARIO_STYLES, type ProjectionCase } from "./calc";
import type { Plan } from "./schemas";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000/api";
const TARGET_MAX_AGE = 110;

type ScenarioKey = "min" | "avg" | "max";
type ScenarioInflation = Record<ScenarioKey, number>;

interface ScenarioTriple {
  min: number;
  avg: number;
  max: number;
}

interface ProjectionRow {
  age: number;
  year: number;
  contribution: number;
  growth: ScenarioTriple;
  spending: ScenarioTriple;
  savings: ScenarioTriple;
}

interface ProjectionRequestPayload {
  basicInfo: {
    currentAge: number;
    retirementAge: number;
    currentSavings: number;
    retirementSpendingRaw: number;
  };
  growthAssumptions: {
    annualInflation: number;
    inflationErrorMargin: number;
    investmentReturnRate: number;
    investmentReturnErrorMargin: number;
  };
  savingsPlan: {
    breakpoints: Array<{
      fromAge: number;
      base: number;
      changeYoY: number;
      years?: number;
    }>;
  };
  yearsAfterRetirement?: number;
  spendingChangeYoY?: number;
}

export interface ProjectionResult {
  cases: ProjectionCase[];
  warnings: string[];
}

export async function runProjection(plan: Plan): Promise<ProjectionResult> {
  const payload = buildProjectionPayload(plan);
  const inflation = deriveScenarioInflation(plan);
  const response = await axios.post<ProjectionRow[]>(`${API_BASE_URL}/projection`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  const rows = response.data;
  return {
    cases: rowsToCases(rows, inflation),
    warnings: [],
  };
}

function buildProjectionPayload(plan: Plan): ProjectionRequestPayload {
  const breakpoints = deriveBreakpoints(plan);
  return {
    basicInfo: {
      currentAge: plan.startAge,
      retirementAge: plan.retireAge,
      currentSavings: plan.initialBalance ?? 0,
      retirementSpendingRaw: plan.startingRetirementSpending ?? 0,
    },
    growthAssumptions: {
      annualInflation: plan.inflationRate,
      inflationErrorMargin: plan.inflationMargin,
      investmentReturnRate: plan.investmentGrowthRate,
      investmentReturnErrorMargin: plan.investmentGrowthMargin,
    },
    savingsPlan: { breakpoints },
    yearsAfterRetirement: deriveYearsAfterRetirement(plan),
    spendingChangeYoY: 0,
  };
}

function deriveBreakpoints(plan: Plan) {
  const primaryAccount = plan.accounts[0];
  if (primaryAccount && primaryAccount.contributions.length > 0) {
    return primaryAccount.contributions.map((row) => ({
      fromAge: row.fromAge,
      base: row.base,
      changeYoY: row.growthRate ?? 0,
      years: row.years,
    }));
  }

  if (plan.annualContribution && plan.annualContribution > 0) {
    const years = Math.max(plan.retireAge - plan.startAge, 0);
    return [
      {
        fromAge: plan.startAge,
        base: plan.annualContribution,
        changeYoY: 0,
        years,
      },
    ];
  }

  return [];
}

function deriveYearsAfterRetirement(plan: Plan): number {
  const spans = plan.spendingSchedule
    .filter((row) => row.fromAge >= plan.retireAge && typeof row.years === "number")
    .map((row) => Math.max(row.fromAge - plan.retireAge, 0) + (row.years ?? 0));
  const derived = spans.length > 0 ? Math.max(...spans) : 0;
  const toLifeExpectancy = Math.max(0, TARGET_MAX_AGE - plan.retireAge);
  const fallback = derived > 0 ? derived : 30;
  return Math.max(fallback, toLifeExpectancy);
}

function deriveScenarioInflation(plan: Plan): ScenarioInflation {
  const inflationAvg = Math.max(plan.inflationRate, 0);
  const inflationMargin = Math.max(plan.inflationMargin, 0);
  const inflationMax = Math.max(inflationAvg + inflationMargin, 0);
  const inflationMin = Math.max(inflationAvg - inflationMargin, 0);
  return {
    min: inflationMax,
    avg: inflationAvg,
    max: inflationMin,
  };
}

function rowsToCases(rows: ProjectionRow[], inflation: ScenarioInflation): ProjectionCase[] {
  if (!rows.length) return [];

  const baseAge = rows[0]?.age ?? 0;
  const scenarioOrder: ScenarioKey[] = ["min", "avg", "max"];
  return scenarioOrder.map((scenario) => {
    const style = SCENARIO_STYLES[scenario] ?? {
      label: scenario.toUpperCase(),
      color: "#475569",
    };
    const inflationRate = inflation[scenario] ?? 0;
    return {
      id: scenario,
      label: style.label,
      color: style.color,
      points: rows.map((row, index) => {
        const yearsSinceStart = row.age - baseAge;
        const nominal = row.savings[scenario];
        const real =
          inflationRate > 0
            ? nominal / Math.pow(1 + inflationRate, Math.max(yearsSinceStart, 0))
            : nominal;
        return {
          yearIndex: index,
          age: row.age,
          nominal,
          real,
        };
      }),
    };
  });
}
