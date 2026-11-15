"""FastAPI scaffold plus a synthetic-only identity foundation.

No production health-data service, database or identity provider is bundled.
The previous /health response remains available.
"""
from __future__ import annotations

import time
from collections.abc import Callable
import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .identity.config import IdentitySettings
from .identity.oidc import OIDCProvider
from .identity.routes import router as identity_router
from .identity.store import SyntheticStore


def create_app(settings: IdentitySettings | None = None, *,
               oidc_transport: httpx.AsyncBaseTransport | None = None,
               clock: Callable[[], float] = time.time) -> FastAPI:
    configured = settings if settings is not None else IdentitySettings.from_environment()
    application = FastAPI(title='senTRA backend scaffold', version='0.2.0', debug=False)
    application.state.identity_settings = configured
    application.state.identity_store = SyntheticStore(configured.sqlite_path, clock=clock) if configured.mode == 'synthetic' and configured.sqlite_path else None
    application.state.oidc_provider = OIDCProvider(configured.oidc, transport=oidc_transport) if configured.oidc else None

    @application.exception_handler(RequestValidationError)
    async def sanitized_validation_error(_request: Request, _error: RequestValidationError):
        # Pydantic's default error body can echo submitted values. Never reflect
        # unexpected input from an identity or future health-data request.
        return JSONResponse({'detail': 'Request format is invalid.'}, status_code=422)

    @application.middleware('http')
    async def protect_api_cache(request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception:
            # Fail closed without echoing credentials, URLs, provider responses,
            # database errors or other internals to a client.
            response = JSONResponse({'detail': 'The requested service is unavailable.'}, status_code=503)
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['Referrer-Policy'] = 'no-referrer'
            response.headers['Vary'] = 'Cookie'
        return response

    @application.get('/health', tags=['scaffold'])
    def health() -> dict[str, object]:
        return {'status': 'scaffold', 'health_data_connected': False,
                'authentication_configured': configured.oidc is not None}

    application.include_router(identity_router)
    return application


app = create_app()
