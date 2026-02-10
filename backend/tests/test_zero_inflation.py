from __future__ import annotations

from math import isclose

from core.projection import (
    BasicInfo,
    ContributionBreakpoint,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
)


def test_zero_inflation_keeps_spending_constant_and_contributions_unchanged():
    """
    With zero inflation and zero spending change, retirement spending should remain flat and contributions stay at the base amount.
    """
    basic = BasicInfo(currentAge=40, retirementAge=42, currentSavings=1000.0, retirementSpendingRaw=20000.0)
    assumptions = GrowthAssumptions(
        annualInflation=0.0,
        inflationErrorMargin=0.0,
        investmentReturnRate=0.05,
        investmentReturnErrorMargin=0.0,
    )
    plan = SavingsPlan(
        breakpoints=[
            ContributionBreakpoint(fromAge=40, base=6000.0, changeYoY=0.0, years=3),
        ]
    )

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        years_after_retirement=2,
        spending_change_yoy=0.0,
    )

    retirement_rows = [row for row in rows if row.age >= basic.retirementAge]
    assert retirement_rows, "should include retirement-age rows"
    for row in retirement_rows:
        assert isclose(row.spending.avg, 20000.0, abs_tol=0.01)

    contribution_rows = [row for row in rows if row.age < basic.retirementAge]
    assert contribution_rows, "should include contribution-age rows"
    for row in contribution_rows:
        assert isclose(row.contribution, 6000.0, abs_tol=0.01)
