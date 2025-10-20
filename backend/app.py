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

from models import Plan
from domain.accumulation import AccumulationResult, accumulate_plan, prepare_plan

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})


@app.post("/api/calc/accumulation")
def accumulation() -> tuple[object, int]:
    """handle accumulation projections"""
    payload = request.get_json(force=True, silent=False)
    try:
        plan = Plan.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"detail": exc.errors()}), HTTPStatus.BAD_REQUEST

    prepared, validation = prepare_plan(plan)
    if validation.errors:
        return jsonify({"detail": validation.errors}), HTTPStatus.BAD_REQUEST

    result: AccumulationResult = accumulate_plan(prepared, base_year=datetime.utcnow().year)
    response = [entry.model_dump(by_alias=True) for entry in result.entries]
    return jsonify(response), HTTPStatus.OK


if __name__ == "__main__":
    app.run(port=5000, debug=True)
