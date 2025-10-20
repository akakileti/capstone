"""Application factory and app-wide configuration."""

from flask import Flask
from flask_cors import CORS

from backend.app.api.routes import api_bp


def create_app() -> Flask:
    """Build the Flask app instance."""
    app = Flask(__name__)

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:5173"]}},
        supports_credentials=True,
    )

    app.register_blueprint(api_bp, url_prefix="/api")
    return app
