"""Data contracts for accumulation calculations."""

from typing import List

from pydantic import BaseModel, Field


class AccumulationRequest(BaseModel):
    """Inputs required to compute an accumulation schedule."""

    initial_balance: float = Field(..., ge=0, description="Initial balance at period 0.")
    annual_rate: float = Field(
        ...,
        ge=0,
        description="Annualized return rate expressed as a decimal (e.g. 0.05 for 5%).",
    )
    years: int = Field(..., ge=1, description="Number of years to project.")
    annual_contribution: float = Field(
        0.0,
        ge=0,
        description="Contribution added at the end of each year.",
    )


class AccumulationPoint(BaseModel):
    """Single row of an accumulation schedule."""

    period: int = Field(..., ge=0)
    balance: float = Field(..., ge=0)


class AccumulationResponse(BaseModel):
    """Projected accumulation schedule."""

    schedule: List[AccumulationPoint]
    final_balance: float = Field(..., ge=0)
