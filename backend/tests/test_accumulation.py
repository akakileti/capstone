from __future__ import annotations

from copy import deepcopy

import pytest
from flask.testing import FlaskClient

from app import app as flask_app
from models import Plan


@pytest.fixture()
def client() -> FlaskClient:
    with flask_app.test_client() as test_client:
        yield test_client


def load_plan() -> dict:
    plan = {
        "startAge": 30,
        "retireAge": 65,
        "inflationRate": 0.03,
        "initialBalance": 25000,
        "annualContribution": 6000,
        "nominalGrowthRate": 0.06,
        "startingRetirementSpending": 40000,
        "accounts": [
            {
                "label": "401k",
                "initialBalance": 25000,
                "contributions": [
                    {"fromAge": 30, "base": 6000, "growthRate": 0.03, "years": 35},
                ],
                "growthOverrides": [],
            }
        ],
        "spendingSchedule": [
            {"fromAge": 65, "annualSpending": 40000, "years": 25},
        ],
        "scenarios": [
            {"kind": "min", "nominalRate": 0.04},
            {"kind": "avg", "nominalRate": 0.06},
            {"kind": "max", "nominalRate": 0.08},
        ],
    }
    Plan.model_validate(plan)
    return plan


def extract_series(response_json: list, scenario_kind: str) -> list:
    return [entry for entry in response_json if entry["scenario"] == scenario_kind]


def test_contribution_monotonicity(client):
    base_plan = load_plan()
    richer_plan = deepcopy(base_plan)
    richer_plan["accounts"][0]["contributions"][0]["base"] = 12000

    base_resp = client.post("/api/calc/accumulation", json=base_plan)
    richer_resp = client.post("/api/calc/accumulation", json=richer_plan)

    assert base_resp.status_code == 200
    assert richer_resp.status_code == 200

    base_avg = extract_series(base_resp.get_json(), "avg")
    richer_avg = extract_series(richer_resp.get_json(), "avg")

    assert richer_avg[-1]["total"]["nominal"] > base_avg[-1]["total"]["nominal"]


def test_real_nominal_alignment(client):
    plan = load_plan()
    plan["scenarios"] = [{"kind": "flat", "nominalRate": plan["inflationRate"]}]
    plan["accounts"][0]["contributions"] = []
    plan["spendingSchedule"] = []
    plan["startingRetirementSpending"] = 0

    resp = client.post("/api/calc/accumulation", json=plan)
    assert resp.status_code == 200
    series = extract_series(resp.get_json(), "flat")
    real_values = [round(entry["total"]["real"], 2) for entry in series]
    assert max(real_values) - min(real_values) < 1.0


def test_growth_override_improves_outcome(client):
    base_plan = load_plan()
    base_plan["accounts"][0]["initialBalance"] = 50000
    base_plan["accounts"][0]["contributions"] = []
    base_plan["startingRetirementSpending"] = 0
    base_plan["spendingSchedule"] = []
    base_plan["scenarios"] = [{"kind": "avg", "nominalRate": 0.05}]

    override_plan = deepcopy(base_plan)
    override_plan["accounts"][0]["growthOverrides"] = [
        {"fromAge": 40, "rate": 0.1, "years": 5},
    ]

    base_resp = client.post("/api/calc/accumulation", json=base_plan)
    override_resp = client.post("/api/calc/accumulation", json=override_plan)
    assert base_resp.status_code == 200
    assert override_resp.status_code == 200

    base_total = extract_series(base_resp.get_json(), "avg")[-1]["total"]["nominal"]
    override_total = extract_series(override_resp.get_json(), "avg")[-1]["total"]["nominal"]
    assert override_total > base_total


def test_retirement_spending_reduces_balance(client):
    saver_plan = load_plan()
    saver_plan["spendingSchedule"] = []
    saver_plan["startingRetirementSpending"] = 0

    spender_plan = deepcopy(load_plan())

    saver_resp = client.post("/api/calc/accumulation", json=saver_plan)
    spender_resp = client.post("/api/calc/accumulation", json=spender_plan)
    assert saver_resp.status_code == 200
    assert spender_resp.status_code == 200

    saver_total = extract_series(saver_resp.get_json(), "avg")[-1]["total"]["nominal"]
    spender_total = extract_series(spender_resp.get_json(), "avg")[-1]["total"]["nominal"]
    assert spender_total < saver_total


def test_overlap_validation_returns_400(client):
    bad_plan = load_plan()
    bad_plan["accounts"][0]["contributions"].append(
        {"fromAge": 32, "base": 1000, "growthRate": 0, "years": 5}
    )

    resp = client.post("/api/calc/accumulation", json=bad_plan)
    assert resp.status_code == 400
    body = resp.get_json()
    assert any("contributions overlap" in message for message in body["detail"])
