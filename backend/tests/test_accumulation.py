from flask.testing import FlaskClient


def test_accumulation_schedule_shape(client: FlaskClient):
    payload = {
        "initial_balance": 1000,
        "annual_rate": 0.05,
        "years": 2,
        "annual_contribution": 100,
    }

    response = client.post("/api/calc/accumulation", json=payload)

    assert response.status_code == 200
    body = response.get_json()
    assert body["final_balance"] > payload["initial_balance"]
    assert len(body["schedule"]) == payload["years"] + 1
    assert body["schedule"][0]["balance"] == payload["initial_balance"]
