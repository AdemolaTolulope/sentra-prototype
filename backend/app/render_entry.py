"""Single-origin synthetic prototype entry point for a Render web service.

The deployment intentionally configures no identity provider by default. It
is not a production health-data service. Render terminates public HTTPS and
passes requests to this HTTP process on its private runtime port.
"""
from pathlib import Path

from .main import app
from .static_site import mount_prototype_frontend

# backend/app/render_entry.py -> project root; the Docker image places its
# compiled Vite output in the same relative location. Never mount the project
# root itself, the environment, the backend source, or the synthetic database.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
mount_prototype_frontend(app, PROJECT_ROOT / 'dist')
