from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

class ContributionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fromAge: int = Field(ge=10, le=100)
    base: float = Field(ge=0)
    growthRate: float = Field(ge=-0.5, le=1)
    years: Optional[int] = Field(default=None, ge=1, le=80)


class GrowthOverrideRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fromAge: int = Field(ge=10, le=100)
    rate: float = Field(ge=-0.5, le=1)
    years: Optional[int] = Field(default=None, ge=1, le=80)


class Account(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    initialBalance: float = Field(ge=0)
    contributions: List[ContributionRow] = Field(default_factory=list)
    growthOverrides: List[GrowthOverrideRow] = Field(default_factory=list)


class SpendingRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fromAge: int = Field(ge=10, le=110)
    annualSpending: float = Field(ge=0)
    years: Optional[int] = Field(default=None, ge=1, le=80)


class GrowthScenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["min", "avg", "max"]
    nominalRate: float


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startAge: int = Field(ge=10, le=100)
    retireAge: int = Field(ge=20, le=110)
    inflationRate: float = Field(ge=0, le=0.3)

    initialBalance: float = 0.0
    annualContribution: float = 0.0
    nominalGrowthRate: float = 0.06

    accounts: List[Account] = Field(default_factory=list)
    spendingSchedule: List[SpendingRow] = Field(default_factory=list)
    scenarios: List[GrowthScenario] = Field(default_factory=list)

    @model_validator(mode="after")
    def ensure_validity(self) -> "Plan":
        if self.retireAge <= self.startAge:
            raise ValueError("retireAge must be greater than startAge")
        if not self.scenarios:
            self.scenarios = [
                GrowthScenario(kind="avg", nominalRate=self.nominalGrowthRate),
            ]
        return self
