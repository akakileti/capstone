import axios from "axios";

import { SCENARIO_STYLES, type ProjectionCase, type YearPoint } from "./calc";
import type { Plan } from "./schemas";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:5000/api";

interface BackendAccountSnapshot {
  label: string;
  nominal: number;
  real: number;
}

interface BackendEntry {
  scenario: string;
  age: number;
  year: number;
  accounts: BackendAccountSnapshot[];
  total: { nominal: number; real: number };
}

interface BackendResponse {
  entries: BackendEntry[];
  warnings?: string[];
}

export interface ProjectionResult {
  cases: ProjectionCase[];
  warnings: string[];
}

export async function runProjection(plan: Plan): Promise<ProjectionResult> {
  const payload = buildPayload(plan);
  const response = await axios.post<BackendResponse>(`${API_BASE_URL}/calc/accumulation`, payload);
  const { entries, warnings = [] } = response.data;
  return {
    cases: buildCases(entries),
    warnings,
  };
}

function buildPayload(plan: Plan) {
  const scenarios = deriveScenarios(plan);
  const initialBalance = plan.initialBalance ?? 0;
  const annualContribution = plan.annualContribution ?? 0;

  return {
    startAge: plan.startAge,
    retireAge: plan.retireAge,
    inflationRate: plan.inflationRate,
    initialBalance,
    annualContribution,
    nominalGrowthRate: plan.nominalGrowthRate ?? plan.investmentGrowthRate,
    accounts: plan.accounts.map((account) => ({
      label: account.label,
      initialBalance: account.initialBalance,
      contributions: account.contributions,
      growthOverrides: account.growthOverrides,
    })),
    spendingSchedule: plan.spendingSchedule,
    scenarios,
  };
}

function deriveScenarios(plan: Plan) {
  const base = plan.investmentGrowthRate;
  const margin = plan.investmentGrowthMargin;
  const clamp = (value: number) => Math.min(Math.max(value, -0.5), 1);
  return [
    { kind: "min", nominalRate: clamp(base - margin) },
    { kind: "avg", nominalRate: clamp(base) },
    { kind: "max", nominalRate: clamp(base + margin) },
  ];
}

function buildCases(entries: BackendEntry[]): ProjectionCase[] {
  const grouped = new Map<string, { style: { label: string; color: string }; points: YearPoint[]; baseAge: number }>();

  entries.forEach((entry) => {
    if (!grouped.has(entry.scenario)) {
      const style = SCENARIO_STYLES[entry.scenario] ?? {
        label: entry.scenario.toUpperCase(),
        color: "#475569",
      };
      grouped.set(entry.scenario, { style, points: [], baseAge: entry.age });
    }

    const bucket = grouped.get(entry.scenario)!;
    bucket.points.push({
      yearIndex: entry.age - bucket.baseAge,
      age: entry.age,
      nominal: entry.total.nominal,
      real: entry.total.real,
    });
  });

  const order = ["min", "avg", "max"];
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return sortedKeys.map((scenario) => {
    const bucket = grouped.get(scenario)!;
    return {
      id: scenario,
      label: bucket.style.label,
      color: bucket.style.color,
      points: bucket.points,
    };
  });
}
