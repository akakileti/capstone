from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

from pydantic import BaseModel, ConfigDict, Field

from models import (
    Account,
    ContributionRow,
    GrowthOverrideRow,
    Plan,
    Scenario,
    SpendingRow,
)


@dataclass
class PlanValidation:
    errors: List[str]
    warnings: List[str]


@dataclass
class Interval:
    start: int
    end: int
    row: object


@dataclass
class PreparedAccount:
    label: str
    initial_balance: float
    contributions: List[ContributionRow]
    growth_overrides: List[GrowthOverrideRow]


@dataclass
class PreparedPlan:
    start_age: int
    retire_age: int
    inflation_rate: float
    accounts: List[PreparedAccount]
    spending_schedule: List[SpendingRow]
    scenarios: List[Scenario]


class AccountSnapshot(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    label: str
    nominal: float
    real: float


class TotalSnapshot(BaseModel):
    nominal: float
    real: float


class YearEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scenario: str
    age: int
    year: int
    accounts: List[AccountSnapshot]
    total: TotalSnapshot


class AccumulationResult(BaseModel):
    entries: List[YearEntry]


def prepare_plan(plan: Plan) -> tuple[PreparedPlan, PlanValidation]:
    accounts = _build_accounts(plan)
    spending = _build_spending(plan)

    errors: List[str] = []
    warnings: List[str] = []

    for account in accounts:
        account_errors, account_warnings = _validate_rows(
            rows=account.contributions,
            fallback_end=plan.retire_age,
            label=f"{account.label} contributions",
        )
        errors.extend(account_errors)
        warnings.extend(account_warnings)

        override_errors, override_warnings = _validate_rows(
            rows=account.growth_overrides,
            fallback_end=plan.retire_age + 1,
            label=f"{account.label} growth overrides",
        )
        errors.extend(override_errors)
        warnings.extend(override_warnings)

    spending_errors, spending_warnings = _validate_rows(
        rows=spending,
        fallback_end=plan.retire_age + 60,
        label="spending schedule",
    )
    errors.extend(spending_errors)
    warnings.extend(spending_warnings)

    prepared = PreparedPlan(
        start_age=plan.start_age,
        retire_age=plan.retire_age,
        inflation_rate=plan.inflation_rate,
        accounts=accounts,
        spending_schedule=spending,
        scenarios=plan.scenarios,
    )
    return prepared, PlanValidation(errors=errors, warnings=warnings)


def accumulate_plan(plan: PreparedPlan, base_year: int) -> AccumulationResult:
    entries: List[YearEntry] = []

    contribution_schedules = [
        _expand_contributions(account.contributions, plan.start_age, plan.retire_age)
        for account in plan.accounts
    ]
    override_schedules = [
        _expand_overrides(account.growth_overrides, plan.start_age, plan.retire_age)
        for account in plan.accounts
    ]
    spending_schedule = _expand_spending(
        plan.spending_schedule, plan.start_age, plan.retire_age + 60
    )

    for scenario in plan.scenarios:
        balances = [account.initial_balance for account in plan.accounts]
        inflation_factor = 1.0

        for offset, age in enumerate(range(plan.start_age, plan.retire_age + 1)):
            #contributions at start of working year
            if age < plan.retire_age:
                for idx, schedule in enumerate(contribution_schedules):
                    contribution = schedule.get(age, 0.0)
                    balances[idx] += contribution

            #spending deducted at retirement and beyond
            if age >= plan.retire_age:
                spending_amount = spending_schedule.get(age, 0.0)
                if spending_amount:
                    _apply_spending(balances, spending_amount)

            #growth per account
            for idx, balance in enumerate(balances):
                override = override_schedules[idx].get(age)
                nominal_rate = override if override is not None else scenario.nominal_rate
                balances[idx] = balance * (1 + nominal_rate)

            total_nominal = sum(balances)
            real_accounts = [balance / inflation_factor for balance in balances]
            total_real = total_nominal / inflation_factor

            account_snapshots = [
                AccountSnapshot(
                    label=plan.accounts[idx].label,
                    nominal=balances[idx],
                    real=real_accounts[idx],
                )
                for idx in range(len(balances))
            ]

            entries.append(
                YearEntry(
                    scenario=scenario.kind,
                    age=age,
                    year=base_year + offset,
                    accounts=account_snapshots,
                    total=TotalSnapshot(nominal=total_nominal, real=total_real),
                )
            )

            inflation_factor *= 1 + plan.inflation_rate

    return AccumulationResult(entries=entries)


def _build_accounts(plan: Plan) -> List[PreparedAccount]:
    accounts: List[PreparedAccount] = [
        PreparedAccount(
            label=account.label,
            initial_balance=account.initial_balance,
            contributions=list(account.contributions),
            growth_overrides=list(account.growth_overrides),
        )
        for account in plan.accounts
    ]

    if not accounts:
        contributions = []
        if plan.annual_contribution:
            contributions.append(
                ContributionRow(
                    fromAge=plan.start_age,
                    base=plan.annual_contribution,
                    growthRate=0,
                    years=max(plan.retire_age - plan.start_age, 1),
                )
            )
        accounts.append(
            PreparedAccount(
                label="Main",
                initial_balance=plan.initial_balance,
                contributions=contributions,
                growth_overrides=[],
            )
        )
    else:
        other_total = sum(acc.initial_balance for acc in accounts[1:])
        first_balance = max(plan.initial_balance - other_total, 0)
        accounts[0].initial_balance = first_balance

    return accounts


def _build_spending(plan: Plan) -> List[SpendingRow]:
    schedule = list(plan.spending_schedule)
    if schedule:
        for idx, row in enumerate(schedule):
            if row.from_age == plan.retire_age:
                schedule[idx] = row.model_copy(update={"annualSpending": plan.starting_retirement_spending})
                break
        else:
            if plan.starting_retirement_spending:
                schedule.append(
                    SpendingRow(
                        fromAge=plan.retire_age,
                        annualSpending=plan.starting_retirement_spending,
                        years=25,
                    )
                )
    elif plan.starting_retirement_spending:
        schedule.append(
            SpendingRow(
                fromAge=plan.retire_age,
                annualSpending=plan.starting_retirement_spending,
                years=25,
            )
        )
    return schedule


def _validate_rows(rows: Iterable[object], fallback_end: int, label: str) -> tuple[List[str], List[str]]:
    entries = list(rows)
    if not entries:
        return [], []

    sorted_rows = sorted(entries, key=lambda row: row.from_age)
    errors: List[str] = []
    warnings: List[str] = []
    previous_end = None

    for idx, row in enumerate(sorted_rows):
        next_start = sorted_rows[idx + 1].from_age if idx + 1 < len(sorted_rows) else fallback_end
        if row.years:
            end = row.from_age + row.years
        else:
            end = next_start
        end = min(end, fallback_end)

        if end <= row.from_age:
            errors.append(f"{label} invalid window at age {row.from_age}")
        if previous_end is not None:
            if row.from_age < previous_end:
                errors.append(f"{label} overlap ages {row.from_age}-{previous_end}")
            elif row.from_age > previous_end:
                warnings.append(f"{label} gap ages {previous_end}-{row.from_age}")
        previous_end = end

    return errors, warnings


def _expand_contributions(rows: List[ContributionRow], start_age: int, retire_age: int) -> Dict[int, float]:
    schedule: Dict[int, float] = {}
    if not rows:
        return schedule
    sorted_rows = sorted(rows, key=lambda row: row.from_age)
    for idx, row in enumerate(sorted_rows):
        next_start = sorted_rows[idx + 1].from_age if idx + 1 < len(sorted_rows) else retire_age
        end = row.from_age + row.years if row.years else next_start
        end = min(end, retire_age)
        for offset, age in enumerate(range(row.from_age, end)):
            if age >= retire_age:
                break
            amount = row.base * (1 + row.growth_rate) ** offset
            schedule[age] = amount
    return schedule


def _expand_overrides(rows: List[GrowthOverrideRow], start_age: int, retire_age: int) -> Dict[int, float]:
    schedule: Dict[int, float] = {}
    if not rows:
        return schedule
    sorted_rows = sorted(rows, key=lambda row: row.from_age)
    for idx, row in enumerate(sorted_rows):
        next_start = sorted_rows[idx + 1].from_age if idx + 1 < len(sorted_rows) else retire_age + 1
        end = row.from_age + row.years if row.years else next_start
        end = min(end, retire_age + 1)
        for age in range(row.from_age, end):
            schedule[age] = row.rate
    return schedule


def _expand_spending(rows: List[SpendingRow], start_age: int, fallback_end: int) -> Dict[int, float]:
    schedule: Dict[int, float] = {}
    if not rows:
        return schedule
    sorted_rows = sorted(rows, key=lambda row: row.from_age)
    for idx, row in enumerate(sorted_rows):
        next_start = sorted_rows[idx + 1].from_age if idx + 1 < len(sorted_rows) else fallback_end
        end = row.from_age + row.years if row.years else next_start
        end = min(end, fallback_end)
        for age in range(row.from_age, end):
            schedule[age] = row.annual_spending
    return schedule


def _apply_spending(balances: List[float], spending_amount: float) -> None:
    total_before = sum(balances)
    if total_before <= 0:
        balances[0] -= spending_amount
        return
    for idx, balance in enumerate(balances):
        share = (balance / total_before) * spending_amount
        balances[idx] -= share
