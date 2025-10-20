"""Placeholder accumulation calculation logic."""

from backend.schemas.accumulation import (
    AccumulationPoint,
    AccumulationRequest,
    AccumulationResponse,
)


def calculate_accumulation_schedule(request: AccumulationRequest) -> AccumulationResponse:
    """Compute a simple compound growth schedule with constant contributions."""
    schedule: list[AccumulationPoint] = [
        AccumulationPoint(period=0, balance=request.initial_balance)
    ]

    balance = request.initial_balance
    for year in range(1, request.years + 1):
        balance = balance * (1 + request.annual_rate) + request.annual_contribution
        schedule.append(AccumulationPoint(period=year, balance=balance))

    return AccumulationResponse(schedule=schedule, final_balance=schedule[-1].balance)
