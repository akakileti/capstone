export interface BasicInfo {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  retirementSpendingRaw: number;
}

export interface GrowthAssumptions {
  annualInflation: number;
  inflationErrorMargin: number;
  investmentReturnRate: number;
  investmentReturnErrorMargin: number;
}

export interface Breakpoint {
  fromAge: number;
  base: number;
  changeYoY: number;
}

export interface SavingsPlan {
  breakpoints: Breakpoint[];
}

export interface ProjectionPoint {
  age: number;
  nominal: number;
  real: number;
}

export interface ProjectionCase {
  id: string;
  label: string;
  color: string;
  points: ProjectionPoint[];
}
