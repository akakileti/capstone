from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContributionRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    from_age: int = Field(..., alias="fromAge", ge=10, le=110)
    base: float = Field(..., ge=0)
    growth_rate: float = Field(0, alias="growthRate", ge=-0.5, le=1)
    years: Optional[int] = Field(None, ge=1, le=80)


class GrowthOverrideRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    from_age: int = Field(..., alias="fromAge", ge=10, le=110)
    rate: float = Field(..., ge=-0.5, le=1)
    years: Optional[int] = Field(None, ge=1, le=80)


class Account(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    label: str
    note: Optional[str] = ""
    initial_balance: float = Field(0, alias="initialBalance")
    contributions: List[ContributionRow] = Field(default_factory=list)
    growth_overrides: List[GrowthOverrideRow] = Field(default_factory=list, alias="growthOverrides")


class SpendingRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    from_age: int = Field(..., alias="fromAge", ge=10, le=120)
    annual_spending: float = Field(..., alias="annualSpending", ge=0)
    years: Optional[int] = Field(None, ge=1, le=80)


class Scenario(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    kind: str
    nominal_rate: float = Field(..., alias="nominalRate", ge=-0.5, le=1)


class Plan(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    start_age: int = Field(..., alias="startAge", ge=10, le=90)
    retire_age: int = Field(..., alias="retireAge", ge=20, le=110)
    inflation_rate: float = Field(..., alias="inflationRate", ge=0, le=0.3)

    initial_balance: float = Field(0, alias="initialBalance", ge=0)
    annual_contribution: float = Field(0, alias="annualContribution", ge=0)
    nominal_growth_rate: float = Field(0.06, alias="nominalGrowthRate", ge=-0.5, le=1)

    accounts: List[Account] = Field(default_factory=list)
    spending_schedule: List[SpendingRow] = Field(default_factory=list, alias="spendingSchedule")
    scenarios: List[Scenario] = Field(default_factory=list)

    starting_retirement_spending: float = Field(0, alias="startingRetirementSpending", ge=0)

    @field_validator("retire_age")
    @classmethod
    def check_retire_after_start(cls, value: int, info):
        start_age = info.data.get("start_age")
        if start_age is not None and value <= start_age:
            raise ValueError("retireAge must be greater than startAge")
        return value

    @model_validator(mode="after")
    def ensure_scenarios(self) -> "Plan":
        if not self.scenarios:
            self.scenarios = [
                Scenario(kind="avg", nominal_rate=self.nominal_growth_rate),
            ]
        return self
