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
  years?: number | null;
}

export interface SavingsPlan {
  breakpoints: Breakpoint[];
}

export interface YearPoint {
  yearIndex: number;
  age: number;
  nominal: number;
  real: number;
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

export interface ProjectionPayload {
  basicInfo: BasicInfo;
  growthAssumptions: GrowthAssumptions;
  savingsPlan: SavingsPlan;
  yearsAfterRetirement?: number;
  spendingChangeYoY?: number;
}

export interface StoredProjectionRecord {
  payload: ProjectionPayload;
  result: ProjectionCase[];
  createdAt: string;
}
