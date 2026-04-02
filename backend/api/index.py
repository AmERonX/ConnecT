"""
Vercel serverless entry point.

Vercel auto-detects this file and exposes the `app` ASGI instance.
All routes are handled by the main FastAPI application.
"""

from app.main import app  # noqa: F401
