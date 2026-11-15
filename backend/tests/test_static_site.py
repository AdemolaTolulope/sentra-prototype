"""Tests for the synthetic single-origin deployment; no cloud is contacted."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.identity.config import IdentitySettings
from app.main import create_app
from app.static_site import mount_prototype_frontend


def test_static_mount_preserves_api_routes_and_does_not_serve_other_files(tmp_path):
    frontend = tmp_path / 'dist'
    (frontend / 'assets').mkdir(parents=True)
    (frontend / 'index.html').write_text('<!doctype html><title>synthetic frontend</title>')
    (frontend / 'assets' / 'app.js').write_text('console.log("synthetic frontend")')
    (frontend / 'sw.js').write_text('// synthetic service worker')
    (tmp_path / 'private-test-file.txt').write_text('should-never-be-served')

    application = create_app(IdentitySettings())
    mount_prototype_frontend(application, frontend)
    with TestClient(application, base_url='https://example.test') as client:
        page = client.get('/')
        assert page.status_code == 200 and 'synthetic frontend' in page.text
        assert client.get('/assets/app.js').status_code == 200
        assert client.get('/sw.js').status_code == 200
        status = client.get('/api/identity/status')
        assert status.status_code == 200 and status.json()['provider'] == 'unconfigured'
        assert status.headers['cache-control'].startswith('no-store')
        assert client.get('/api/identity/login').status_code == 503
        unknown = client.get('/api/not-a-real-endpoint')
        assert unknown.status_code == 404 and 'synthetic frontend' not in unknown.text
        assert client.get('/health').json()['health_data_connected'] is False
        assert client.get('/private-test-file.txt').status_code == 404
        assert client.get('/%2e%2e/private-test-file.txt').status_code == 404


def test_static_mount_rejects_missing_build(tmp_path):
    application = create_app(IdentitySettings())
    with pytest.raises(RuntimeError, match='compiled prototype frontend is missing'):
        mount_prototype_frontend(application, Path(tmp_path / 'not-built'))
