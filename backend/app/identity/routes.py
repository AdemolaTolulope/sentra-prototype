"""Synthetic-only account API. No real healthcare data or external provider is bundled."""
from __future__ import annotations

import hmac
import re
import secrets
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from .oidc import OIDCError
from .store import Conflict, Denied, Principal, SyntheticStore, csrf_for_session, subject_digest

router = APIRouter(prefix='/api/identity', tags=['synthetic identity'])
SESSION_COOKIE = '__Host-sentra-session'
FLOW_COOKIE = '__Host-sentra-flow'
OPAQUE = re.compile(r'^[A-Za-z0-9_-]{32,256}$')


def _store(request: Request) -> SyntheticStore:
    store = request.app.state.identity_store
    if store is None:
        raise HTTPException(status_code=503, detail='Synthetic identity storage is not configured.')
    return store


def _principal(request: Request) -> tuple[SyntheticStore, Principal, str]:
    store = _store(request)
    # Removing provider configuration disables access even if an old local
    # session row still exists. A configured provider outage prevents new
    # logins; existing sessions are not remotely introspected (see handover).
    if request.app.state.oidc_provider is None or request.app.state.identity_settings.oidc is None:
        raise HTTPException(status_code=503, detail='Identity provider is not configured.')
    token = request.cookies.get(SESSION_COOKIE, '')
    if not OPAQUE.fullmatch(token):
        raise HTTPException(status_code=401, detail='An authenticated session is required.')
    principal = store.session(token)
    if principal is None:
        raise HTTPException(status_code=401, detail='An authenticated session is required.')
    return store, principal, token


def _csrf(request: Request, store: SyntheticStore, actor: Principal, token: str) -> None:
    supplied = request.headers.get('x-csrf-token', '')
    origin = request.headers.get('origin')
    config = request.app.state.identity_settings.oidc
    expected_origin = None
    if config:
        parsed = urlsplit(config.redirect_uri)
        expected_origin = f'{parsed.scheme}://{parsed.netloc}'
    origin_ok = not origin or (expected_origin is not None and hmac.compare_digest(origin, expected_origin))
    if not origin_ok or len(supplied) != 64 or not hmac.compare_digest(supplied, csrf_for_session(token)):
        store.audit_denial(actor.id, 'csrf.check', 'account', actor.id)
        raise HTTPException(status_code=403, detail='Request could not be authorized.')


def _profile(value: dict[str, object]) -> dict[str, object]:
    return {**value, 'classification': 'synthetic'}


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    language: Literal['en', 'yo', 'ha', 'ig', 'pcm']
    professional_category: Literal['doctor', 'dentist', 'nurse-midwife', 'pharmacist', 'laboratory-scientist', 'community-health', 'other'] | None = None


class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    resource_id: UUID
    recipient_id: UUID
    duration_days: int = Field(default=30, ge=1, le=90, strict=True)


@router.get('/status')
def status(request: Request) -> dict[str, object]:
    settings = request.app.state.identity_settings
    provider = settings.oidc
    ready = bool(settings.mode == 'synthetic' and request.app.state.identity_store is not None and provider)
    return {
        'mode': settings.mode,
        'storage': 'synthetic-local' if request.app.state.identity_store is not None else 'unavailable',
        'provider': 'configured-not-verified' if ready else 'unconfigured',
        'sign_in_configured': ready,
        'registration_configured': bool(ready and provider and provider.signup_authorization_url),
        'recovery_configured': bool(ready and provider and (provider.recovery_url or provider.recovery_via_login)),
        'email_verification_required': bool(ready and provider and provider.require_email_verified),
        'email_delivery_connected_by_app': False,
        'professional_verification_connected': False,
        'real_health_data_supported': False,
    }


async def _start(request: Request, kind: str, signup: bool, *, force_login: bool = False) -> Response:
    store = _store(request)
    settings = request.app.state.identity_settings
    provider = request.app.state.oidc_provider
    if provider is None or settings.oidc is None:
        raise HTTPException(status_code=503, detail='Identity provider is not configured.')
    if signup and not settings.oidc.signup_authorization_url:
        raise HTTPException(status_code=503, detail='Provider registration is not configured.')
    state, browser_secret, nonce, verifier = (secrets.token_urlsafe(32), secrets.token_urlsafe(32), secrets.token_urlsafe(32), secrets.token_urlsafe(64))
    try:
        redirect = await provider.authorization_url(state=state, nonce=nonce, verifier=verifier, signup=signup, force_login=force_login)
    except OIDCError:
        store.audit_denial(None, 'oidc.start', 'provider')
        raise HTTPException(status_code=503, detail='Identity provider is unavailable or could not be verified.') from None
    store.begin_flow(state, browser_secret, nonce, verifier, kind, settings.flow_seconds)
    response = RedirectResponse(redirect, status_code=302)
    response.set_cookie(FLOW_COOKIE, browser_secret, max_age=settings.flow_seconds, path='/', secure=True, httponly=True, samesite='lax')
    return response


@router.get('/login')
async def login(request: Request, kind: Literal['patient', 'professional'] = 'patient') -> Response:
    return await _start(request, kind, False)


@router.get('/register')
async def register(request: Request, kind: Literal['patient', 'professional'] = 'patient') -> Response:
    return await _start(request, kind, True)


@router.get('/recovery')
async def recovery(request: Request) -> Response:
    _store(request)
    config = request.app.state.identity_settings.oidc
    if not config:
        raise HTTPException(status_code=503, detail='Provider account recovery is not configured.')
    if config.recovery_via_login:
        # This does not reset a password. It starts a normal, state-bound OIDC
        # login so the user may choose the provider's recovery option.
        return await _start(request, 'patient', False, force_login=True)
    if not config.recovery_url:
        raise HTTPException(status_code=503, detail='Provider account recovery is not configured.')
    # The provider controls recovery and delivery; this app sends no email.
    return RedirectResponse(config.recovery_url, status_code=302)


def _failed_callback() -> JSONResponse:
    response = JSONResponse({'detail': 'Sign-in could not be verified. Start again or contact support.'}, status_code=400)
    response.delete_cookie(FLOW_COOKIE, path='/', secure=True, httponly=True, samesite='lax')
    return response


@router.get('/callback')
async def callback(request: Request) -> Response:
    store = _store(request)
    settings = request.app.state.identity_settings
    provider = request.app.state.oidc_provider
    if provider is None or settings.oidc is None:
        raise HTTPException(status_code=503, detail='Identity provider is not configured.')
    states = request.query_params.getlist('state')
    codes = request.query_params.getlist('code')
    browser_secret = request.cookies.get(FLOW_COOKIE, '')
    if len(states) != 1 or len(codes) != 1 or not OPAQUE.fullmatch(states[0]) or not OPAQUE.fullmatch(browser_secret) or not codes[0] or len(codes[0]) > 4096:
        store.audit_denial(None, 'oidc.callback', 'provider')
        return _failed_callback()
    flow = store.consume_flow(states[0], browser_secret)
    if flow is None:
        store.audit_denial(None, 'oidc.callback', 'provider')
        return _failed_callback()
    try:
        subject = await provider.exchange_and_validate(code=codes[0], verifier=flow.verifier, expected_nonce=flow.nonce)
        subject_hash = subject_digest(settings.oidc.subject_hmac_key, settings.oidc.issuer, subject)
        previous = request.cookies.get(SESSION_COOKIE)
        if previous and not OPAQUE.fullmatch(previous):
            previous = None
        token, _ = store.create_session(settings.oidc.issuer, subject_hash, flow.intent, settings.session_seconds, previous)
    except (OIDCError, Denied):
        store.audit_denial(None, 'oidc.callback', 'provider')
        return _failed_callback()
    response = RedirectResponse('/#/account', status_code=303)
    response.delete_cookie(FLOW_COOKIE, path='/', secure=True, httponly=True, samesite='lax')
    response.set_cookie(SESSION_COOKIE, token, max_age=settings.session_seconds, path='/', secure=True, httponly=True, samesite='lax')
    return response


@router.get('/session')
def session(request: Request) -> dict[str, object]:
    store, actor, token = _principal(request)
    try:
        profile = store.read_profile(actor, actor.id)
    except Denied:
        raise HTTPException(status_code=401, detail='An authenticated session is required.') from None
    return {'status': 'authenticated', 'profile': _profile(profile), 'expires_at': actor.expires_at,
            'csrf_token': csrf_for_session(token), 'provider_session_logout': 'not-configured'}


@router.post('/logout')
def logout(request: Request) -> Response:
    store, actor, token = _principal(request)
    _csrf(request, store, actor, token)
    if not store.logout(token):
        raise HTTPException(status_code=401, detail='An authenticated session is required.')
    response = JSONResponse({'status': 'signed-out', 'provider_session_ended': False})
    response.delete_cookie(SESSION_COOKIE, path='/', secure=True, httponly=True, samesite='lax')
    return response


@router.get('/profiles/{account_id}')
def profile(request: Request, account_id: UUID) -> dict[str, object]:
    store, actor, _ = _principal(request)
    try:
        return _profile(store.read_profile(actor, str(account_id)))
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None


@router.patch('/profile')
def update_profile(request: Request, data: ProfileUpdate) -> dict[str, object]:
    store, actor, token = _principal(request)
    _csrf(request, store, actor, token)
    try:
        return _profile(store.update_profile(actor, language=data.language, category=data.professional_category))
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None


@router.get('/resources')
def resources(request: Request) -> list[dict[str, object]]:
    store, actor, _ = _principal(request)
    try:
        return store.list_resources(actor)
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None


@router.post('/resources', status_code=201)
async def create_resource(request: Request) -> dict[str, str]:
    store, actor, token = _principal(request)
    _csrf(request, store, actor, token)
    if await request.body():
        raise HTTPException(status_code=422, detail='This synthetic example does not accept any content.')
    try:
        resource_id = store.create_resource(actor)
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None
    return {'id': resource_id, 'classification': 'synthetic'}


@router.get('/resources/{resource_id}')
def resource(request: Request, resource_id: UUID) -> dict[str, str]:
    store, actor, _ = _principal(request)
    try:
        return store.read_resource(actor, str(resource_id))
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None


@router.get('/consents')
def consents(request: Request) -> list[dict[str, object]]:
    store, actor, _ = _principal(request)
    try:
        return store.list_grants(actor)
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None


@router.post('/consents', status_code=201)
def grant_consent(request: Request, data: ConsentRequest) -> dict[str, object]:
    store, actor, token = _principal(request)
    _csrf(request, store, actor, token)
    try:
        return store.grant(actor, str(data.resource_id), str(data.recipient_id), data.duration_days)
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None
    except Conflict:
        raise HTTPException(status_code=409, detail='An active synthetic grant already exists.') from None


@router.delete('/consents/{consent_id}', status_code=204)
def withdraw_consent(request: Request, consent_id: UUID) -> Response:
    store, actor, token = _principal(request)
    _csrf(request, store, actor, token)
    try:
        store.revoke_grant(actor, str(consent_id))
    except Denied:
        raise HTTPException(status_code=403, detail='Request could not be authorized.') from None
    return Response(status_code=204)
