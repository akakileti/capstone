"""Ping utility used by the API health-check."""


def get_ping_message() -> str:
    """Return a static ping message."""
    return "pong"
