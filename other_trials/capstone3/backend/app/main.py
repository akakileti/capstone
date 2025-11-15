from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class BasicInfo(BaseModel):
    currentAge: int
    retirementAge: int
    currentSavings: float
    retirementSpendingRaw: float


class ScenarioValues(BaseModel):
    min: float
    avg: float
    max: float


class GrowthScenarios(BaseModel):
    inflation: ScenarioValues
    growth: ScenarioValues


class GrowthAssumptions(BaseModel):
    annualInflation: float
    inflationErrorMargin: float
    investmentReturnRate: float
    investmentReturnErrorMargin: float

    def to_scenarios(self) -> GrowthScenarios:
        return GrowthScenarios(
            inflation=ScenarioValues(
                min=self.annualInflation - self.inflationErrorMargin,
                avg=self.annualInflation,
                max=self.annualInflation + self.inflationErrorMargin,
            ),
            growth=ScenarioValues(
                min=self.investmentReturnRate - self.investmentReturnErrorMargin,
                avg=self.investmentReturnRate,
                max=self.investmentReturnRate + self.investmentReturnErrorMargin,
            ),
        )


class ContributionBreakpoint(BaseModel):
    """starting at fromAge, contribution = base * (1 + changeYoY)^(years since fromAge).
    If years is None, it runs until the next breakpoint (or retirement)."""

    fromAge: int
    base: float
    changeYoY: float
    years: Optional[int] = None


class SavingsPlan(BaseModel):
    breakpoints: List[ContributionBreakpoint] = Field(default_factory=list)


class YearRow(BaseModel):
    age: int
    year: int
    contribution: float
    growth: ScenarioValues
    savings: ScenarioValues


class YearRowWithSpending(YearRow):
    spending: ScenarioValues


def _make_intervals(
    rows: List[ContributionBreakpoint], stop_age: int
) -> List[Tuple[int, int, ContributionBreakpoint]]:
    """Return [(startAge, endAgeExclusive, row), ...], sorted by start."""
    rows_sorted = sorted(rows, key=lambda r: r.fromAge)
    out: List[Tuple[int, int, ContributionBreakpoint]] = []
    for i, row in enumerate(rows_sorted):
        next_start = rows_sorted[i + 1].fromAge if i + 1 < len(rows_sorted) else stop_age
        end = row.fromAge + (
            row.years if row.years is not None else max(next_start - row.fromAge, 0)
        )
        if end <= row.fromAge:
            end = next_start
        out.append((row.fromAge, end, row))
    return out


def _active_row(
    intervals: List[Tuple[int, int, ContributionBreakpoint]], age: int
) -> Optional[ContributionBreakpoint]:
    for start, end, row in intervals:
        if start <= age < end:
            return row
    return None


def project_savings_table(
    basic: BasicInfo,
    assumptions: GrowthAssumptions,
    plan: SavingsPlan,
    current_year: Optional[int] = None,
) -> List[YearRow]:
    scenarios = assumptions.to_scenarios()
    default_years = max(0, basic.retirementAge - basic.currentAge)
    intervals = _make_intervals(
        plan.breakpoints
        or [
            ContributionBreakpoint(
                fromAge=basic.currentAge, base=0.0, changeYoY=0.0, years=default_years
            )
        ],
        stop_age=basic.retirementAge + 1,
    )

    year0 = current_year or datetime.now().year

    bal_min = float(basic.currentSavings)
    bal_avg = float(basic.currentSavings)
    bal_max = float(basic.currentSavings)

    rows: List[YearRow] = []
    for step, age in enumerate(range(basic.currentAge, basic.retirementAge + 1)):
        year = year0 + step
        contrib = 0.0
        rule = _active_row(intervals, age)
        if rule:
            t = age - rule.fromAge
            contrib = rule.base * ((1.0 + rule.changeYoY) ** t)

        bal_min += contrib
        bal_avg += contrib
        bal_max += contrib

        gmin = scenarios.growth.min
        gavg = scenarios.growth.avg
        gmax = scenarios.growth.max
        bal_min *= 1.0 + gmin
        bal_avg *= 1.0 + gavg
        bal_max *= 1.0 + gmax

        rows.append(
            YearRow(
                age=age,
                year=year,
                contribution=round(contrib, 2),
                growth=ScenarioValues(min=gmin, avg=gavg, max=gmax),
                savings=ScenarioValues(
                    min=round(bal_min, 2),
                    avg=round(bal_avg, 2),
                    max=round(bal_max, 2),
                ),
            )
        )

    return rows


class ProjectionRequest(BaseModel):
    basic: BasicInfo
    assumptions: GrowthAssumptions
    plan: SavingsPlan
    currentYear: Optional[int] = None


class ProjectionResponse(BaseModel):
    rows: List[YearRow]


def default_payload() -> ProjectionRequest:
    #simple helper to keep default data in one place
    return ProjectionRequest(
        basic=BasicInfo(
            currentAge=30,
            retirementAge=65,
            currentSavings=50000,
            retirementSpendingRaw=50000,
        ),
        assumptions=GrowthAssumptions(
            annualInflation=0.03,
            inflationErrorMargin=0.02,
            investmentReturnRate=0.06,
            investmentReturnErrorMargin=0.021,
        ),
        plan=SavingsPlan(
            breakpoints=[
                ContributionBreakpoint(fromAge=30, base=6000, changeYoY=0.03, years=35)
            ]
        ),
        currentYear=datetime.now().year,
    )


app = FastAPI(title="Retirement Projection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4321",
        "http://127.0.0.1:4321",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/defaults", response_model=ProjectionRequest)
def get_defaults() -> ProjectionRequest:
    return default_payload()


@app.post("/api/project", response_model=ProjectionResponse)
def project(request: ProjectionRequest) -> ProjectionResponse:
    rows = project_savings_table(
        basic=request.basic,
        assumptions=request.assumptions,
        plan=request.plan,
        current_year=request.currentYear,
    )
    return ProjectionResponse(rows=rows)
