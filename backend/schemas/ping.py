"""Pydantic schema for the ping endpoint."""

from pydantic import BaseModel


class PingResponse(BaseModel):
    message: str
