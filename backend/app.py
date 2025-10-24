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

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
            ]
        }
    },
)


@app.post("/api/calc/accumulation")
def accumulation() -> tuple[object, int]:
    payload = request.get_json(force=True, silent=False)
    try:
        plan = Plan.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"detail": exc.errors()}), HTTPStatus.BAD_REQUEST

    try:
        payload: AccumulationPayload = accumulations(plan, base_year=datetime.utcnow().year)
    except PlanValidationError as exc:
        return jsonify({"error": exc.errors}), HTTPStatus.BAD_REQUEST

    return jsonify(payload.model_dump()), HTTPStatus.OK


if __name__ == "__main__":
    app.run(port=5000, debug=True)
