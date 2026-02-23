#setup: python -m venv .venv
#setup: source .venv/bin/activate   # (windows: .venv\Scripts\activate)
#setup: pip install -U pip -r requirements.txt
#setup: flask --app app run --port 5000 --debug

from __future__ import annotations

import os
from datetime import datetime
from http import HTTPStatus

from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from core.projection import ProjectionRequest, project_savings_with_retirement

app = Flask(__name__)


def _load_allowed_origins() -> set[str]:
    """Compose the allowed origins from defaults plus a comma-separated env var."""
    defaults = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }
    raw_env = os.getenv("CORS_ORIGINS", "")
    env_origins = {
        origin.strip().rstrip("/")
        for origin in raw_env.split(",")
        if origin.strip()
    }
    return {origin for origin in (defaults | env_origins) if origin}


ALLOWED_ORIGINS = _load_allowed_origins()

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": list(ALLOWED_ORIGINS),
        }
    },
)
@app.route("/api/projection", methods=["POST"])
def projection() -> tuple[object, int]:
    """Return the multi-scenario projection table the frontend expects."""
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


@app.route("/health", methods=["GET"])
def health():
    return "ok", HTTPStatus.OK


if __name__ == "__main__":
    app.run(port=3000, debug=True)
