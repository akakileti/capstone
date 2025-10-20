from flask.testing import FlaskClient


def test_ping_returns_pong(client: FlaskClient):
    response = client.get("/api/ping")

    assert response.status_code == 200
    assert response.json == {"message": "pong"}
