from __future__ import annotations

from math import isclose

from core.projection import (
    BasicInfo,
    ContributionBreakpoint,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
)


def test_zero_spending_allows_growth_to_accumulate():
    """
    With zero spending, savings should grow through contributions and investment returns.
    """
    basic = BasicInfo(currentAge=30, retirementAge=32, currentSavings=10000.0, retirementSpendingRaw=0.0)
    assumptions = GrowthAssumptions(
        annualInflation=0.02,
        inflationErrorMargin=0.0,
        investmentReturnRate=0.05,
        investmentReturnErrorMargin=0.0,
    )
    plan = SavingsPlan(
        breakpoints=[
            ContributionBreakpoint(fromAge=30, base=4000.0, changeYoY=0.0, years=3),
        ]
    )

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        years_after_retirement=0,
        spending_change_yoy=0.0,
    )

    # Floor without growth: starting 10k + contributions (no contribution at retirement age).
    min_expected = [14000.0, 18000.0, 18000.0]
    prev = 0.0
    for row, floor in zip(rows, min_expected):
        assert isclose(row.spending.avg, 0.0, abs_tol=0.0)
        assert row.savings.avg >= floor, "savings should at least match contributions with no spending"
        assert row.savings.avg >= prev, "savings should not decrease when there is no spending"
        prev = row.savings.avg
