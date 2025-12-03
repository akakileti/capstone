from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel


# -----------------------------
# Existing models (unchanged)
# -----------------------------


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

    # --- New helpers for the "from-scratch" backend ---

    @property
    def inflation_band(self) -> ScenarioValues:
        """
        Convenience wrapper returning min/avg/max inflation.
        Reuses the same parameters as to_scenarios().
        """
        return ScenarioValues(
            min=self.annualInflation - self.inflationErrorMargin,
            avg=self.annualInflation,
            max=self.annualInflation + self.inflationErrorMargin,
        )

    @property
    def growth_band(self) -> ScenarioValues:
        """
        Convenience wrapper returning min/avg/max nominal growth.
        """
        return ScenarioValues(
            min=self.investmentReturnRate - self.investmentReturnErrorMargin,
            avg=self.investmentReturnRate,
            max=self.investmentReturnRate + self.investmentReturnErrorMargin,
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
        # if years is None, run until the next breakpoint; else for yearss
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

        # 1) apply growth on starting balance only (contrib added after growth)
        start_min, start_avg, start_max = bal_min, bal_avg, bal_max
        gmin, gavg, gmax = scenarios.growth.min, scenarios.growth.avg, scenarios.growth.max
        bal_min = start_min * (1.0 + gmin)
        bal_avg = start_avg * (1.0 + gavg)
        bal_max = start_max * (1.0 + gmax)

        # 2) add this year's contribution (no growth this year)
        bal_min += contrib
        bal_avg += contrib
        bal_max += contrib

        # 3) record row (rounded a bit for nice output/dollar)
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
    Uses all existing structures, but extends past retirement and applies drawdown.

    Conventions:
      - Working years (age < retirementAge):
            1) Contribution at START of year  (same as current function)
            2) Then apply growth.
      - Retirement years (age >= retirementAge):
            1) Compute spending from retirementSpendingRaw (today's $), per band.
            2) Subtract spending at START of year (can go negative).
            3) Then apply growth.
      - Band pairing:
            Min = worst case = low growth + HIGH inflation (max drawdown)
            Avg = middle = avg growth + avg inflation
            Max = best case = high growth + LOW inflation (light drawdown)
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
            # 1) Contribution for the year (no growth until year end)
            rule = _active_row(intervals, age)
            if rule:
                t = age - rule.fromAge  # years since this breakpoint began
                contrib = rule.base * ((1 + rule.changeYoY) ** t)

            # 2) Apply growth to starting balances only
            start_min, start_avg, start_max = bal_min, bal_avg, bal_max
            bal_min = start_min * (1 + g_min)
            bal_avg = start_avg * (1 + g_avg)
            bal_max = start_max * (1 + g_max)

            # 3) Add contribution after growth (not grown this year)
            bal_min += contrib
            bal_avg += contrib
            bal_max += contrib

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

            # 1) Subtract spending before growth
            start_min = bal_min - spend_min
            start_avg = bal_avg - spend_avg
            start_max = bal_max - spend_max

            # 2) Apply growth on the post-spending balance
            bal_min = start_min * (1 + g_min)
            bal_avg = start_avg * (1 + g_avg)
            bal_max = start_max * (1 + g_max)

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


# ------------------------------------------------
# New "from-scratch" backend with clean plan + spending logic
# ------------------------------------------------


class Scenario(str, Enum):
    MIN = "min"
    AVG = "avg"
    MAX = "max"


class ScenarioRates(BaseModel):
    scenario: Scenario
    inflation: float       # nominal inflation
    nominal_growth: float  # nominal investment growth

    @property
    def real_growth(self) -> float:
        # growth above inflation
        return (1 + self.nominal_growth) / (1 + self.inflation) - 1.0


class SavingsAccountConfig(BaseModel):
    """
    One savings line:
      - initial_balance: starting in this account at current_age
      - from_age: when contributions start
      - years: how long contributions run (None => until retirement)
      - base_contribution: first year's contribution at from_age
      - contribution_growth: growth rate on the contribution itself (not the investment growth)
    """

    name: str = "Savings #1"

    initial_balance: float = 0.0

    from_age: int
    years: Optional[int] = None  # if None, run until retirement_age

    base_contribution: float
    contribution_growth: float   # e.g. 0.03 means 3% more contribution each year


class RetirementSpendingConfig(BaseModel):
    """
    One retirement spending line:
      - from_age: first age this spending applies
      - years: number of years (None => until end of projection)
      - annual_spending_today: amount in today's dollars
    """

    name: str = "Retirement Spending #1"

    from_age: int
    years: Optional[int]
    annual_spending_today: float


class PlanInputs(BaseModel):
    """
    High-level plan object that holds everything for the new backend.
    """

    # Basic information
    current_age: int
    retirement_age: int
    current_savings: float  # outside of individual accounts (e.g. cash)
    desired_retirement_spending_today: float

    # Global growth assumptions (reuses existing GrowthAssumptions)
    growth: GrowthAssumptions

    # Detailed lines
    savings_accounts: List[SavingsAccountConfig] = []
    spending_items: List[RetirementSpendingConfig] = []


class SingleScenarioYear(BaseModel):
    """
    Internal: one row for a single scenario (min or avg or max).
    """

    age: int
    year_index: int
    starting_balance: float
    contributions: float
    spending: float
    ending_balance: float


class YearlyRow(BaseModel):
    """
    Aggregate year row combining min/avg/max from the single-scenario runs.
    """

    age: int
    year_index: int
    starting_balance: ScenarioValues
    contributions: ScenarioValues
    spending: ScenarioValues
    ending_balance: ScenarioValues


def rates_for_scenario(assumptions: GrowthAssumptions, scenario: Scenario) -> ScenarioRates:
    """
    Map GrowthAssumptions into a single pair of (inflation, nominal_growth)
    per scenario, pairing them as:

      MIN: worst case -> highest inflation, lowest growth
      AVG: middle      -> avg inflation, avg growth
      MAX: best case   -> lowest inflation, highest growth
    """
    inf = assumptions.inflation_band
    gr = assumptions.growth_band

    if scenario == Scenario.MIN:
        return ScenarioRates(
            scenario=scenario,
            inflation=inf.max,
            nominal_growth=gr.min,
        )
    elif scenario == Scenario.MAX:
        return ScenarioRates(
            scenario=scenario,
            inflation=inf.min,
            nominal_growth=gr.max,
        )
    else:  # AVG
        return ScenarioRates(
            scenario=scenario,
            inflation=inf.avg,
            nominal_growth=gr.avg,
        )


def get_effective_spending_items(plan: PlanInputs, years_after_retirement: int) -> List[RetirementSpendingConfig]:
    """
    If the user didn't specify any spending_items, fall back to
    desired_retirement_spending_today as a single default line.
    """
    if plan.spending_items:
        return plan.spending_items

    return [
        RetirementSpendingConfig(
            name="Default retirement spending",
            from_age=plan.retirement_age,
            years=years_after_retirement,
            annual_spending_today=plan.desired_retirement_spending_today,
        )
    ]


def simulate_scenario(
    plan: PlanInputs,
    scenario: Scenario,
    years_after_retirement: int = 30,
) -> List[SingleScenarioYear]:
    """
    Simulate a single world (min OR avg OR max).

    Spending logic:
      - annual_spending_today is in today's dollars
      - we grow it into the future using THIS scenario's inflation
      - we only subtract in years where the line is active
      - spending keeps growing year-by-year while active
    """
    rates = rates_for_scenario(plan.growth, scenario)
    effective_spending = get_effective_spending_items(plan, years_after_retirement)

    start_age = plan.current_age
    end_age = plan.retirement_age + years_after_retirement

    # Starting total balance: top-level + all account initial balances
    balance = float(plan.current_savings) + sum(acc.initial_balance for acc in plan.savings_accounts)

    rows: List[SingleScenarioYear] = []

    # Track last year's nominal spending per item index
    prev_spend_by_item: Dict[int, float] = {}

    for year_index, age in enumerate(range(start_age, end_age + 1)):
        starting = balance

        # ---------- Contributions ----------
        contrib = 0.0
        for acc in plan.savings_accounts:
            # Determine if this account is active at this age
            acc_end_age = (
                acc.from_age + acc.years
                if acc.years is not None
                else plan.retirement_age  # default: contributions stop at retirement
            )
            if acc.from_age <= age < acc_end_age:
                # t = years since account started
                t = age - acc.from_age
                contrib += acc.base_contribution * ((1 + acc.contribution_growth) ** t)

        # ---------- Spending ----------
        spend = 0.0

        # Only subtract spending in retirement years
        if age >= plan.retirement_age:
            infl = rates.inflation

            for idx, item in enumerate(effective_spending):
                # Is this age within this item's active window?
                if age < item.from_age:
                    continue
                if item.years is not None and age >= item.from_age + item.years:
                    continue

                if age == item.from_age:
                    # First active year: grow today's dollars to 'from_age'
                    years_to_start = item.from_age - plan.current_age
                    nominal_spend = item.annual_spending_today * ((1 + infl) ** years_to_start)
                else:
                    # Subsequent years: last year's spending * (1 + inflation)
                    last = prev_spend_by_item.get(idx, 0.0)
                    nominal_spend = last * (1 + infl)

                prev_spend_by_item[idx] = nominal_spend
                spend += nominal_spend

        # ---------- End-of-year balance ----------
        # Growth happens on starting balance minus spending; contributions are added after growth.
        balance = (starting - spend) * (1 + rates.nominal_growth)
        balance += contrib

        rows.append(
            SingleScenarioYear(
                age=age,
                year_index=year_index,
                starting_balance=starting,
                contributions=contrib,
                spending=spend,
                ending_balance=balance,
            )
        )

    return rows


def project_plan(plan: PlanInputs, years_after_retirement: int = 30) -> List[YearlyRow]:
    """
    Run min/avg/max scenarios and combine them into a list of YearlyRow objects
    with ScenarioValues(min/avg/max) for each quantity.
    """
    rows_min = simulate_scenario(plan, Scenario.MIN, years_after_retirement)
    rows_avg = simulate_scenario(plan, Scenario.AVG, years_after_retirement)
    rows_max = simulate_scenario(plan, Scenario.MAX, years_after_retirement)

    result: List[YearlyRow] = []
    for r_min, r_avg, r_max in zip(rows_min, rows_avg, rows_max):
        assert r_min.age == r_avg.age == r_max.age
        assert r_min.year_index == r_avg.year_index == r_max.year_index

        result.append(
            YearlyRow(
                age=r_min.age,
                year_index=r_min.year_index,
                starting_balance=ScenarioValues(
                    min=r_min.starting_balance,
                    avg=r_avg.starting_balance,
                    max=r_max.starting_balance,
                ),
                contributions=ScenarioValues(
                    min=r_min.contributions,
                    avg=r_avg.contributions,
                    max=r_max.contributions,
                ),
                spending=ScenarioValues(
                    min=r_min.spending,
                    avg=r_avg.spending,
                    max=r_max.spending,
                ),
                ending_balance=ScenarioValues(
                    min=r_min.ending_balance,
                    avg=r_avg.ending_balance,
                    max=r_max.ending_balance,
                ),
            )
        )

    return result


__all__ = [
    # original exports
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
    # new backend exports
    "Scenario",
    "SavingsAccountConfig",
    "RetirementSpendingConfig",
    "PlanInputs",
    "SingleScenarioYear",
    "YearlyRow",
    "rates_for_scenario",
    "simulate_scenario",
    "project_plan",
]
