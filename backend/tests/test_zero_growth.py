from __future__ import annotations

from math import isclose

from core.projection import (
    BasicInfo,
    ContributionBreakpoint,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
)


def test_zero_growth_accumulates_contributions_only():
    """
    With zero investment return, savings should equal starting balance plus cumulative contributions (no growth boost)
    """
    basic = BasicInfo(currentAge=25, retirementAge=27, currentSavings=1000.0, retirementSpendingRaw=0.0)
    assumptions = GrowthAssumptions(
        annualInflation=0.02,
        inflationErrorMargin=0.0,
        investmentReturnRate=0.0,
        investmentReturnErrorMargin=0.0,
    )
    plan = SavingsPlan(
        breakpoints=[
            ContributionBreakpoint(fromAge=25, base=5000.0, changeYoY=0.0, years=3),
        ]
    )

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        years_after_retirement=0,
        spending_change_yoy=0.0,
    )

    expected_totals = [6000.0, 11000.0, 11000.0]  #1000 start + 2 contributions; no contribution at retirement age
    prev = 0.0
    for row, expected_total in zip(rows, expected_totals):
        assert isclose(row.contribution, 5000.0 if row.age < basic.retirementAge else 0.0, abs_tol=0.01)
        assert isclose(row.spending.avg, 0.0, abs_tol=0.0)
        assert isclose(row.savings.avg, expected_total, abs_tol=0.01)
        assert row.savings.avg >= prev, "savings should not decrease without spending"
        prev = row.savings.avg
