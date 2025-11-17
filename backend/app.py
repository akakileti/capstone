#setup: python -m venv .venv
#setup: source .venv/bin/activate   # (windows: .venv\Scripts\activate)
#setup: pip install -U pip -r requirements.txt
#setup: flask --app app run --port 5000 --debug

from __future__ import annotations

from datetime import datetime
from http import HTTPStatus

from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from core.projection import ProjectionRequest, project_savings_with_retirement

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        }
    },
)


@app.after_request
def add_cors_headers(response):
    """Ensure all API responses include the required CORS headers."""
    origin = request.headers.get("Origin", "")
    allowed_origins = {
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    }

    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/projection", methods=["POST", "OPTIONS"])
def projection() -> tuple[object, int]:
    """Return the multi-scenario projection table the frontend expects."""
    if request.method == "OPTIONS":
        resp = app.make_response(("", HTTPStatus.NO_CONTENT))
        resp.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        return resp

    payload = request.get_json(force=True, silent=False)
    try:
        projection_request = ProjectionRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"detail": exc.errors()}), HTTPStatus.BAD_REQUEST

    rows = project_savings_with_retirement(
        basic=projection_request.basicInfo,
        assumptions=projection_request.growthAssumptions,
        plan=projection_request.savingsPlan,
        current_year=datetime.utcnow().year,
        years_after_retirement=(
            projection_request.yearsAfterRetirement
            if projection_request.yearsAfterRetirement is not None
            else 30
        ),
        spending_change_yoy=(
            projection_request.spendingChangeYoY
            if projection_request.spendingChangeYoY is not None
            else 0.0
        ),
    )

    return jsonify([row.model_dump() for row in rows]), HTTPStatus.OK


if __name__ == "__main__":
    app.run(port=3000, debug=True)
