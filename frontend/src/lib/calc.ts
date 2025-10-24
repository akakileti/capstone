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

export const SCENARIO_STYLES: Record<string, { label: string; color: string }> = {
  min: { label: "Min", color: "#1d4ed8" },
  avg: { label: "Avg", color: "#dc2626" },
  max: { label: "Max", color: "#f59e0b" },
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
