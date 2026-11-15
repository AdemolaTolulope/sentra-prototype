"""Mount the compiled prototype UI without exposing source or the local store.

This is for the synthetic demonstration deployment, not a production gateway.
Existing API routes must be mounted before this catch-all static mount.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


def mount_prototype_frontend(application: FastAPI, directory: Path) -> None:
    """Serve the built UI at / while preserving the existing same-origin API."""
    root = directory.resolve()
    if not root.is_dir() or not (root / 'index.html').is_file():
        raise RuntimeError('The compiled prototype frontend is missing; run npm run build first.')
    application.mount('/', StaticFiles(directory=root, html=True), name='prototype-frontend')
