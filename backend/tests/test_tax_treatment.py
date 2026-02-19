import math
import pathlib
import sys

# Ensure the backend package root is on sys.path whether pytest is run from repo root or backend/
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.projection import (  # type: ignore  # path injected above
    BasicInfo,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
)


def run_projection(treatment: str) -> float:
    """Helper: returns ending avg balance for a simple 2-year horizon."""

    assumptions = GrowthAssumptions(
        annualInflation=0.0,
        inflationErrorMargin=0.0,
        investmentReturnRate=0.10,  # 10% nominal
        investmentReturnErrorMargin=0.0,
    )

    basic = BasicInfo(
        currentAge=30,
        retirementAge=31,  # one working year, then first retirement year
        currentSavings=1000.0,
        retirementSpendingRaw=1000.0,  # withdraw 1k net in first retirement year
    )

    plan = SavingsPlan(
        breakpoints=[],  # no additional contributions
        taxTreatment=treatment,
        taxRate=0.20,
    )

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        current_year=2024,
        years_after_retirement=0,  # include retirement year only
        spending_change_yoy=0.0,
    )

    return rows[-1].savings.avg  # ending balance in the average scenario


def test_tax_treatments_relative_outcomes():
    entry_balance = run_projection("entry")
    growth_balance = run_projection("growth")
    exit_balance = run_projection("exit")

    # Ordering: entry (no gain tax) should be highest, growth (cap gains on withdrawal) next, exit (tax all withdrawals) lowest
    assert entry_balance > growth_balance > exit_balance

    # Sanity: entry should preserve the 10% growth minus the single 1k withdrawal
    assert math.isclose(entry_balance, 1100.0 - 1000.0 + 10.0, rel_tol=1e-3)
