from __future__ import annotations

from math import isclose

from core.projection import (
    BasicInfo,
    ContributionBreakpoint,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
)


def test_projection_zeroes_produces_zero_rows():
    """
    Sanity check: with zero starting savings, zero contributions, and no growth, all outputs stay at zero.
    """
    basic = BasicInfo(currentAge=25, retirementAge=26, currentSavings=0.0, retirementSpendingRaw=0.0)
    assumptions = GrowthAssumptions(
        annualInflation=0.0,
        inflationErrorMargin=0.0,
        investmentReturnRate=0.0,
        investmentReturnErrorMargin=0.0,
    )
    plan = SavingsPlan(
        breakpoints=[
            ContributionBreakpoint(fromAge=25, base=0.0, changeYoY=0.0, years=2),
        ]
    )

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        years_after_retirement=1,
        spending_change_yoy=0.0,
    )

    assert rows, "projection should return at least one row"
    #just check all are zeros, don't need to go line by line
    for row in rows:
        assert isclose(row.contribution, 0.0, abs_tol=0.0)
        assert isclose(row.spending.min, 0.0, abs_tol=0.0)
        assert isclose(row.spending.avg, 0.0, abs_tol=0.0)
        assert isclose(row.spending.max, 0.0, abs_tol=0.0)
        assert isclose(row.savings.min, 0.0, abs_tol=0.0)
        assert isclose(row.savings.avg, 0.0, abs_tol=0.0)
        assert isclose(row.savings.max, 0.0, abs_tol=0.0)
