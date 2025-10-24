from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional, Sequence

from pydantic import BaseModel, ConfigDict

from models import (
    Account,
    ContributionRow,
    GrowthOverrideRow,
    GrowthScenario,
    Plan,
    SpendingRow,
)


class PlanValidationError(ValueError):
    def __init__(self, errors: List[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass
class Interval:
    start: int
    end: int
    row: object


@dataclass
class PreparedAccount:
    label: str
    initial_balance: float
    contributions: List[Interval]
    overrides: List[Interval]


@dataclass
class PreparedPlan:
    start_age: int
    retire_age: int
    inflation_rate: float
    accounts: List[PreparedAccount]
    spending: List[Interval]
    scenarios: List[GrowthScenario]


@dataclass
class PreparationResult:
    plan: Optional[PreparedPlan]
    errors: List[str]
    warnings: List[str]


class AccountSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    nominal: float
    real: float


class TotalSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nominal: float
    real: float


class YearEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario: str
    age: int
    year: int
    accounts: List[AccountSnapshot]
    total: TotalSnapshot


class AccumulationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: List[YearEntry]
    warnings: List[str] = []


def make_intervals(
    rows: Iterable[object],
    stop_age: int,
    label: str,
) -> tuple[List[Interval], List[str], List[str]]:
    sorted_rows = sorted(rows, key=lambda row: getattr(row, "fromAge"))
    intervals: List[Interval] = []
    errors: List[str] = []
    warnings: List[str] = []

    previous_end: Optional[int] = None

    for index, row in enumerate(sorted_rows):
        start = getattr(row, "fromAge")
        next_start = getattr(sorted_rows[index + 1], "fromAge") if index + 1 < len(sorted_rows) else stop_age
        if getattr(row, "years") is not None:
            end = min(start + getattr(row, "years"), stop_age)
        else:
            end = min(next_start, stop_age)

        if end <= start:
            errors.append(f"{label} invalid interval at age {start}")

        if previous_end is not None:
            if start < previous_end:
                errors.append(f"{label} overlap ages {start}-{previous_end}")
            elif start > previous_end:
                warnings.append(f"{label} gap ages {previous_end}-{start}")

        intervals.append(Interval(start=start, end=end, row=row))
        previous_end = end

    return intervals, errors, warnings


def active_row(intervals: Sequence[Interval], age: int) -> Optional[object]:
    for interval in intervals:
        if interval.start <= age < interval.end:
            return interval.row
    return None


def fisher_rate(nominal_rate: float, inflation_rate: float) -> float:
    return (1 + nominal_rate) / (1 + inflation_rate) - 1


def prepare_plan(plan: Plan) -> PreparationResult:
    accounts = list(plan.accounts)
    if not accounts and (plan.initialBalance or plan.annualContribution):
        derived_years = max(plan.retireAge - plan.startAge, 1)
        accounts = [
            Account(
                label="Main",
                initialBalance=plan.initialBalance,
                contributions=[
                    ContributionRow(
                        fromAge=plan.startAge,
                        base=plan.annualContribution,
                        growthRate=0.0,
                        years=derived_years,
                    )
                ],
                growthOverrides=[],
            )
        ]

    prepared_accounts: List[PreparedAccount] = []
    errors: List[str] = []
    warnings: List[str] = []

    for account in accounts:
        contributions, contrib_errors, contrib_warnings = make_intervals(
            account.contributions,
            plan.retireAge,
            f"{account.label} contributions",
        )
        overrides, override_errors, override_warnings = make_intervals(
            account.growthOverrides,
            plan.retireAge + 1,
            f"{account.label} overrides",
        )

        errors.extend(contrib_errors)
        errors.extend(override_errors)
        warnings.extend(contrib_warnings)
        warnings.extend(override_warnings)

        prepared_accounts.append(
            PreparedAccount(
                label=account.label,
                initial_balance=account.initialBalance,
                contributions=contributions,
                overrides=overrides,
            )
        )

    if not prepared_accounts:
        errors.append("plan requires at least one account or initial balance/contribution")
        return PreparationResult(plan=None, errors=errors, warnings=warnings)

    spending_intervals, spending_errors, spending_warnings = make_intervals(
        plan.spendingSchedule,
        plan.retireAge + 60,
        "spending",
    )
    errors.extend(spending_errors)
    warnings.extend(spending_warnings)

    prepared = PreparedPlan(
        start_age=plan.startAge,
        retire_age=plan.retireAge,
        inflation_rate=plan.inflationRate,
        accounts=prepared_accounts,
        spending=spending_intervals,
        scenarios=plan.scenarios,
    )
    return PreparationResult(plan=prepared, errors=errors, warnings=warnings)


def accumulations(plan: Plan, base_year: Optional[int] = None) -> AccumulationPayload:
    base_year = base_year or datetime.utcnow().year
    preparation = prepare_plan(plan)
    if preparation.errors or not preparation.plan:
        raise PlanValidationError(preparation.errors)

    entries: List[YearEntry] = []
    prepared = preparation.plan

    for scenario in prepared.scenarios:
        nominal_balances = [account.initial_balance for account in prepared.accounts]
        real_balances = [account.initial_balance for account in prepared.accounts]

        for offset, age in enumerate(range(prepared.start_age, prepared.retire_age + 1)):
            price_level = (1 + prepared.inflation_rate) ** (age - prepared.start_age)

            if age < prepared.retire_age:
                for index, account in enumerate(prepared.accounts):
                    contribution_row = active_row(account.contributions, age)
                    if contribution_row is None:
                        continue
                    exponent = age - contribution_row.fromAge
                    amount_nominal = contribution_row.base * (1 + contribution_row.growthRate) ** exponent
                    nominal_balances[index] += amount_nominal
                    real_balances[index] += amount_nominal / price_level

            if age >= prepared.retire_age:
                spending_row = active_row(prepared.spending, age)
                if spending_row and spending_row.annualSpending:
                    amount_nominal = spending_row.annualSpending
                    amount_real = amount_nominal / price_level
                    _apply_spending_balances(nominal_balances, amount_nominal)
                    _apply_spending_balances(real_balances, amount_real)

            for index, account in enumerate(prepared.accounts):
                override_row = active_row(account.overrides, age)
                nominal_rate = override_row.rate if override_row else scenario.nominalRate
                real_rate = fisher_rate(nominal_rate, prepared.inflation_rate)
                nominal_balances[index] *= 1 + nominal_rate
                real_balances[index] *= 1 + real_rate

            total_nominal = sum(nominal_balances)
            total_real = sum(real_balances)

            entries.append(
                YearEntry(
                    scenario=scenario.kind,
                    age=age,
                    year=base_year + offset,
                    accounts=[
                        AccountSnapshot(
                            label=prepared.accounts[index].label,
                            nominal=nominal_balances[index],
                            real=real_balances[index],
                        )
                        for index in range(len(prepared.accounts))
                    ],
                    total=TotalSnapshot(nominal=total_nominal, real=total_real),
                )
            )

    return AccumulationPayload(entries=entries, warnings=preparation.warnings)


def _apply_spending_balances(balances: List[float], amount: float) -> None:
    total_before = sum(balances)
    if total_before <= 0:
        balances[0] -= amount
        return
    for index, balance in enumerate(balances):
        share = (balance / total_before) * amount
        balances[index] -= share
