"""HTTP routes for the Flask API."""

from http import HTTPStatus
from typing import Any, Dict

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from backend.core.accumulation import calculate_accumulation_schedule
from backend.core.ping import get_ping_message
from backend.schemas.accumulation import (
    AccumulationRequest,
    AccumulationResponse,
)
from backend.schemas.ping import PingResponse

api_bp = Blueprint("api", __name__)


@api_bp.errorhandler(ValidationError)
def _handle_validation_error(exc: ValidationError):
    """Convert Pydantic validation errors into JSON responses."""
    return jsonify({"detail": exc.errors()}), HTTPStatus.UNPROCESSABLE_ENTITY


@api_bp.get("/ping")
def ping() -> Any:
    """Health-check endpoint."""
    response = PingResponse(message=get_ping_message())
    return jsonify(response.model_dump())


@api_bp.post("/calc/accumulation")
def accumulation() -> Any:
    """Placeholder accumulation endpoint."""
    raw_payload: Dict[str, Any] = request.get_json(force=True, silent=False)
    payload = AccumulationRequest.model_validate(raw_payload)
    result = calculate_accumulation_schedule(payload)
    response = AccumulationResponse.model_validate(result.model_dump())
    return jsonify(response.model_dump())
