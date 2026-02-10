from __future__ import annotations

from flask.testing import FlaskClient

from app import app as flask_app


def projection_payload() -> dict:
    return {
        "basicInfo": {
            "currentAge": 30,
            "retirementAge": 65,
            "currentSavings": 50000,
            "retirementSpendingRaw": 40000,
        },
        "growthAssumptions": {
            "annualInflation": 0.03,
            "inflationErrorMargin": 0.01,
            "investmentReturnRate": 0.06,
            "investmentReturnErrorMargin": 0.01,
        },
        "savingsPlan": {
            "breakpoints": [
                {"fromAge": 30, "base": 6000, "changeYoY": 0.03, "years": 35},
            ],
        },
        "yearsAfterRetirement": 5,
        "spendingChangeYoY": 0.0,
    }


def test_projection_endpoint_returns_expected_rows():
    with flask_app.test_client() as client:
        resp = client.post("/api/projection", json=projection_payload())

    assert resp.status_code == 200
    rows = resp.get_json()
    assert isinstance(rows, list)
    assert rows, "response should include at least one projection row"

    payload = projection_payload()
    expected_last_age = payload["basicInfo"]["retirementAge"] + payload["yearsAfterRetirement"]
    assert rows[-1]["age"] == expected_last_age

    # Ensure we captured spending once the simulated person retires
    retirement_age = payload["basicInfo"]["retirementAge"]
    retirement_rows = [row for row in rows if row["age"] == retirement_age]
    assert retirement_rows and retirement_rows[0]["spending"]["avg"] > 0


def test_invalid_payload_returns_400():
    with flask_app.test_client() as client:
        resp = client.post("/api/projection", json={"basicInfo": {}})

    assert resp.status_code == 400
    body = resp.get_json()
    assert "detail" in body
