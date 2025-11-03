from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

from pydantic import BaseModel


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
    breakpoints: List[ContributionBreakpoint] = []


class YearRow(BaseModel):
    age: int
    year: int
    contribution: float
    growth: ScenarioValues
    # savings.min captures the pessimistic path (low returns + high inflation + high spending),
    # while savings.max is the optimistic path.
    savings: ScenarioValues


class YearRowWithSpending(YearRow):
    # inherits age, year, contribution, growth, savings
    spending: ScenarioValues


class ProjectionRequest(BaseModel):
    basicInfo: BasicInfo
    growthAssumptions: GrowthAssumptions
    savingsPlan: SavingsPlan
    yearsAfterRetirement: Optional[int] = None
    spendingChangeYoY: Optional[float] = None


def _make_intervals(
    rows: List[ContributionBreakpoint], stop_age: int
) -> List[Tuple[int, int, ContributionBreakpoint]]:
    """Return [(startAge, endAgeExclusive, row), ...], sorted by start."""
    rows_sorted = sorted(rows, key=lambda r: r.fromAge)
    out: List[Tuple[int, int, ContributionBreakpoint]] = []
    for i, row in enumerate(rows_sorted):
        next_start = rows_sorted[i + 1].fromAge if i + 1 < len(rows_sorted) else stop_age
        # if years is None, run until the next breakpoint; else for `years` years
        end = row.fromAge + (row.years if row.years is not None else max(next_start - row.fromAge, 0))
        if end <= row.fromAge:  # guard against weird inputs
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
    """
    Build a year-by-year table from currentAge..retirementAge (inclusive).

    Order of operations (per year):
      1) Add contribution at START of year (uses active breakpoint).
      2) Apply GROWTH for the year (min/avg/max nominal rates, annual compounding).
      3) Record row with nested {growth: {min,avg,max}, savings: {min,avg,max}}.

    Starts from basic.currentSavings BEFORE the first year's contribution.
    """
    scenarios = assumptions.to_scenarios()  # has scenarios.growth.min/avg/max

    # if no breakpoints are provided, default to "no contributions"
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

        # compute contribution for this age
        contrib = 0.0
        rule = _active_row(intervals, age)
        if rule:
            t = age - rule.fromAge  # years since this breakpoint began
            contrib = rule.base * ((1.0 + rule.changeYoY) ** t)

        # 1) add contribution at start of year
        bal_min += contrib
        bal_avg += contrib
        bal_max += contrib

        # 2) apply growth for the full year
        gmin, gavg, gmax = scenarios.growth.min, scenarios.growth.avg, scenarios.growth.max
        bal_min *= (1.0 + gmin)
        bal_avg *= (1.0 + gavg)
        bal_max *= (1.0 + gmax)

        # 3) record row (rounded a bit for nice output)
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


def project_savings_with_retirement(
    basic: BasicInfo,
    assumptions: GrowthAssumptions,
    plan: SavingsPlan,
    current_year: Optional[int] = None,
    years_after_retirement: int = 30,
    spending_change_yoy: float = 0.0,  # extra real change; 0 = same lifestyle in real terms
) -> List[YearRowWithSpending]:
    """
    Uses all your existing structures, but extends past retirement and applies drawdown.

    Conventions:
      - Working years (age < retirementAge):
            1) Contribution at START of year  (same as your current function)
            2) Then apply growth.
      - Retirement years (age >= retirementAge):
            1) Compute spending from retirementSpendingRaw (today's $), per band.
            2) Subtract spending at START of year (can go negative).
            3) Then apply growth.
      - Band pairing:
            Min  = worst case  = low growth + HIGH inflation (max drawdown)
            Avg  = middle      = avg growth + avg inflation
            Max  = best case   = high growth + LOW inflation (light drawdown)
    """

    s = assumptions.to_scenarios()

    # Pair growth + inflation for scenarios
    g_min, g_avg, g_max = s.growth.min, s.growth.avg, s.growth.max
    inf_min, inf_avg, inf_max = s.inflation.min, s.inflation.avg, s.inflation.max

    # How far to simulate (retirement + N years)
    end_age = basic.retirementAge + max(0, years_after_retirement)

    # Contribution schedule (only matters before retirement)
    default_years = max(0, basic.retirementAge - basic.currentAge)
    intervals = _make_intervals(
        plan.breakpoints
        or [
            ContributionBreakpoint(
                fromAge=basic.currentAge,
                base=0.0,
                changeYoY=0.0,
                years=default_years,
            )
        ],
        stop_age=basic.retirementAge,
    )

    year0 = current_year or datetime.now().year

    # Starting balances
    bal_min = float(basic.currentSavings)
    bal_avg = float(basic.currentSavings)
    bal_max = float(basic.currentSavings)

    # Base nominal spending at retirement for each band
    years_to_ret = max(0, basic.retirementAge - basic.currentAge)
    if basic.retirementSpendingRaw > 0:
        # Worst (min savings): use highest inflation
        spend0_min = basic.retirementSpendingRaw * (1 + inf_max) ** years_to_ret
        # Middle
        spend0_avg = basic.retirementSpendingRaw * (1 + inf_avg) ** years_to_ret
        # Best (max savings): use lowest inflation
        spend0_max = basic.retirementSpendingRaw * (1 + inf_min) ** years_to_ret
    else:
        spend0_min = spend0_avg = spend0_max = 0.0

    # Track last year's nominal spending per scenario
    prev_spend_min = None
    prev_spend_avg = None
    prev_spend_max = None

    rows: List[YearRowWithSpending] = []

    for step, age in enumerate(range(basic.currentAge, end_age + 1)):
        year = year0 + step
        contrib = 0.0
        spend_min = spend_avg = spend_max = 0.0

        # ---------- Working years ----------
        if age < basic.retirementAge:
            # 1) Contribution at START of year (same as your existing logic)
            rule = _active_row(intervals, age)
            if rule:
                t = age - rule.fromAge  # years since this breakpoint began
                contrib = rule.base * ((1 + rule.changeYoY) ** t)
                bal_min += contrib
                bal_avg += contrib
                bal_max += contrib

            # 2) Apply growth for the full year
            bal_min *= (1 + g_min)
            bal_avg *= (1 + g_avg)
            bal_max *= (1 + g_max)

        # ---------- Retirement years ----------
        else:

            def next_spend(base0: float, prev: Optional[float], infl: float) -> float:
                if base0 <= 0:
                    return 0.0
                if prev is None:
                    # first retirement year
                    return base0
                # subsequent: last year's spending * (inflation + optional extra real change)
                return prev * (1 + infl + spending_change_yoy)

            # Worst path (savings.min): high inflation -> biggest spending
            spend_min = next_spend(spend0_min, prev_spend_min, inf_max)
            # Middle
            spend_avg = next_spend(spend0_avg, prev_spend_avg, inf_avg)
            # Best path (savings.max): low inflation -> smallest spending
            spend_max = next_spend(spend0_max, prev_spend_max, inf_min)

            prev_spend_min = spend_min
            prev_spend_avg = spend_avg
            prev_spend_max = spend_max

            # 1) Subtract spending at START of year
            bal_min -= spend_min
            bal_avg -= spend_avg
            bal_max -= spend_max

            # 2) Apply growth
            bal_min *= (1 + g_min)
            bal_avg *= (1 + g_avg)
            bal_max *= (1 + g_max)

        # Record this year
        rows.append(
            YearRowWithSpending(
                age=age,
                year=year,
                contribution=round(contrib, 2),
                growth=ScenarioValues(min=g_min, avg=g_avg, max=g_max),
                spending=ScenarioValues(
                    min=round(spend_min, 2),
                    avg=round(spend_avg, 2),
                    max=round(spend_max, 2),
                ),
                savings=ScenarioValues(
                    min=round(bal_min, 2),
                    avg=round(bal_avg, 2),
                    max=round(bal_max, 2),
                ),
            )
        )

    return rows


__all__ = [
    "BasicInfo",
    "GrowthAssumptions",
    "ScenarioValues",
    "GrowthScenarios",
    "ContributionBreakpoint",
    "SavingsPlan",
    "YearRow",
    "YearRowWithSpending",
    "ProjectionRequest",
    "_make_intervals",
    "_active_row",
    "project_savings_table",
    "project_savings_with_retirement",
]
