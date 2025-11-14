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

from domain.accumulation import AccumulationPayload, PlanValidationError, accumulations
from models import Plan
from core.projection import (
    ProjectionRequest,
    project_savings_with_retirement,
)

from model_trial import (
    BasicInfo,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
    rows_to_projection_cases, 
)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ]
    }
})

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

@app.route("/api/calc/accumulation", methods=["POST", "OPTIONS"])
def accumulation() -> tuple[object, int]:
    if request.method == "OPTIONS":
        resp = app.make_response(("", HTTPStatus.NO_CONTENT))
        resp.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        return resp
    payload = request.get_json(force=True, silent=False)
    try:
        plan = Plan.model_validate(payload)
    except ValidationError as exc:
        response = jsonify({"detail": exc.errors()})
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        return response, HTTPStatus.BAD_REQUEST

    try:
        payload: AccumulationPayload = accumulations(plan, base_year=datetime.utcnow().year)
    except PlanValidationError as exc:
        response = jsonify({"error": exc.errors})
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        return response, HTTPStatus.BAD_REQUEST

    response = jsonify(payload.model_dump())
    response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
    return response, HTTPStatus.OK


@app.route("/api/projection", methods=["POST", "OPTIONS"])
def projection() -> tuple[object, int]:
    if request.method == "OPTIONS":
        return ("", HTTPStatus.NO_CONTENT)
    """Return the multi-scenario projection table the frontend expects."""

    # Frontend usage example (React/TS):
    # const payload = {
    #   basicInfo,
    #   growthAssumptions,
    #   savingsPlan,
    #   yearsAfterRetirement,
    #   spendingChangeYoY,
    # };
    # const res = await fetch("/api/projection", {
    #   method: "POST",
    #   headers: { "Content-Type": "application/json" },
    #   body: JSON.stringify(payload),
    # });
    # const rows = await res.json();
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

    #cases = rows_to_projection_cases(rows)
    #return jsonify([c.model_dump() for c in cases]), 200


if __name__ == "__main__":
    app.run(port=3000, debug=True)
