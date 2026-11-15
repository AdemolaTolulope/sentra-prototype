"""Synthetic API security tests with an in-process, test-only OIDC double."""
import json
import secrets
import sqlite3
import time
from contextlib import closing
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from app.identity.config import IdentitySettings, OIDCConfig
from app.identity.routes import SESSION_COOKIE
from app.main import create_app
from tests.oidc_double import OIDCTestDouble


class Clock:
    def __init__(self):
        self.value = int(time.time())

    def __call__(self):
        return self.value


@pytest.fixture
def test_env(tmp_path):
    config = OIDCConfig(issuer='https://issuer.example.test', client_id='synthetic-client',
        redirect_uri='https://app.example.test/api/identity/callback', subject_hmac_key=secrets.token_bytes(32),
        client_secret=secrets.token_urlsafe(32), signup_authorization_url='https://issuer.example.test/signup',
        recovery_url='https://issuer.example.test/recover')
    double = OIDCTestDouble(config)
    clock = Clock()
    settings = IdentitySettings(mode='synthetic', sqlite_path=tmp_path/'synthetic.db', oidc=config, session_seconds=300, flow_seconds=120)
    app = create_app(settings, oidc_transport=double.transport, clock=clock)
    return app, double, clock


def client(app):
    return TestClient(app, base_url='https://app.example.test', follow_redirects=False)


def sign_in(c, double, subject, kind='patient', *, signup=False, **claims):
    endpoint = 'register' if signup else 'login'
    start = c.get(f'/api/identity/{endpoint}', params={'kind': kind})
    assert start.status_code == 302, start.text
    assert '__Host-sentra-flow=' in start.headers['set-cookie']
    assert 'HttpOnly' in start.headers['set-cookie'] and 'Secure' in start.headers['set-cookie']
    code, state = double.issue(start.headers['location'], subject, **claims)
    response = c.get('/api/identity/callback', params={'code': code, 'state': state})
    assert response.status_code == 303, response.text
    assert response.headers['location'] == '/#/account'
    cookies = response.headers.get_list('set-cookie')
    assert any(SESSION_COOKIE in value and 'HttpOnly' in value and 'Secure' in value for value in cookies)
    session = c.get('/api/identity/session')
    assert session.status_code == 200
    assert session.headers['cache-control'].startswith('no-store')
    return session.json()


def csrf(session):
    return {'x-csrf-token': session['csrf_token'], 'origin': 'https://app.example.test'}


def test_unconfigured_provider_never_claims_connection(tmp_path):
    app = create_app(IdentitySettings(mode='synthetic', sqlite_path=tmp_path/'db.sqlite'))
    with client(app) as c:
        response = c.get('/api/identity/status')
        assert response.status_code == 200 and response.headers['cache-control'].startswith('no-store')
        data = response.json()
        assert data['provider'] == 'unconfigured' and data['storage'] == 'synthetic-local'
        assert not data['sign_in_configured'] and not data['registration_configured'] and not data['recovery_configured']
        assert not data['real_health_data_supported'] and not data['email_delivery_connected_by_app']
        assert c.get('/api/identity/login').status_code == 503
        assert c.get('/api/identity/register').status_code == 503
        assert c.get('/api/identity/recovery').status_code == 503
        assert c.get('/api/identity/session').status_code == 503
        # A provider removal also disables any previously stored local session.
        token, _ = app.state.identity_store.create_session('https://old.example.test', 'synthetic-hash', 'patient', 300)
        c.cookies.set(SESSION_COOKIE, token, domain='app.example.test', path='/')
        assert c.get('/api/identity/session').status_code == 503
        assert c.get('/health').json() == {'status': 'scaffold', 'health_data_connected': False, 'authentication_configured': False}
    disabled = create_app(IdentitySettings())
    with client(disabled) as c:
        assert c.get('/api/identity/status').json()['mode'] == 'disabled'
        assert c.get('/api/identity/login').status_code == 503


def test_oidc_flow_state_nonce_replay_and_privilege_rejection(test_env):
    app, double, _ = test_env
    with client(app) as c:
        status = c.get('/api/identity/status').json()
        assert status['provider'] == 'configured-not-verified' and status['sign_in_configured']
        assert not status['professional_verification_connected'] and not status['real_health_data_supported']
        assert c.get('/api/identity/login', params={'kind': 'administrator'}).status_code == 422
        start = c.get('/api/identity/login', params={'kind': 'professional'})
        code, state = double.issue(start.headers['location'], 'synthetic-professional')
        invalid = c.get('/api/identity/callback', params={'code': code, 'state': secrets.token_urlsafe(32)})
        assert invalid.status_code == 400 and c.get('/api/identity/session').status_code == 401
        # Restart and use a valid browser-bound state.
        session = sign_in(c, double, 'synthetic-professional', 'professional', signup=True,
                          roles=['administrator'], verification='verified')
        assert session['profile']['role'] == 'professional' and session['profile']['verification'] == 'unverified'
        assert session['profile']['classification'] == 'synthetic'
        assert c.get('/api/identity/callback', params={'code': code, 'state': state}).status_code == 400
        # A later patient intent cannot change the professional role of an existing identity.
        old_cookie = c.cookies.get(SESSION_COOKIE)
        session2 = sign_in(c, double, 'synthetic-professional', 'patient')
        assert session2['profile']['id'] == session['profile']['id'] and session2['profile']['role'] == 'professional'
        assert old_cookie and app.state.identity_store.session(old_cookie) is None
        assert c.get('/api/identity/recovery').headers['location'] == 'https://issuer.example.test/recover'
        audit = c.get('/api/identity/audit')
        assert audit.status_code == 404 and audit.headers['cache-control'].startswith('no-store')


def test_verified_email_policy_and_hosted_login_recovery_are_tested_only(tmp_path):
    config = OIDCConfig(issuer='https://issuer.example.test', client_id='synthetic-client',
        redirect_uri='https://app.example.test/api/identity/callback', subject_hmac_key=secrets.token_bytes(32),
        client_secret=secrets.token_urlsafe(32), require_email_verified=True, recovery_via_login=True)
    double = OIDCTestDouble(config)
    app = create_app(IdentitySettings(mode='synthetic', sqlite_path=tmp_path/'strict.sqlite3', oidc=config), oidc_transport=double.transport)
    with client(app) as c:
        status = c.get('/api/identity/status').json()
        assert status['email_verification_required'] and status['recovery_configured']
        assert not status['email_delivery_connected_by_app']
        for value in (None, False, 'true'):
            start = c.get('/api/identity/login')
            assert parse_qs(urlsplit(start.headers['location']).query)['scope'] == ['openid email']
            claims = {} if value is None else {'email_verified': value}
            code, state = double.issue(start.headers['location'], 'synthetic-subject', **claims)
            assert c.get('/api/identity/callback', params={'code': code, 'state': state}).status_code == 400
            assert c.get('/api/identity/session').status_code == 401
        # Recovery merely starts the provider's hosted login; it sends no mail.
        start = c.get('/api/identity/recovery')
        assert start.status_code == 302
        query = parse_qs(urlsplit(start.headers['location']).query)
        assert query['prompt'] == ['login'] and query['code_challenge_method'] == ['S256']
        code, state = double.issue(start.headers['location'], 'synthetic-subject', email_verified=True, email='synthetic-mailbox@example.invalid')
        assert c.get('/api/identity/callback', params={'code': code, 'state': state}).status_code == 303
        assert c.get('/api/identity/session').status_code == 200
    assert b'synthetic-mailbox@example.invalid' not in app.state.identity_store.path.read_bytes()


def test_generic_login_uri_does_not_preserve_new_professional_intent(tmp_path):
    # Models an unverified professional signup followed by a provider's
    # generic return-to-login link; this does not contact an actual provider.
    config = OIDCConfig(issuer='https://issuer.example.test', client_id='synthetic-client',
        redirect_uri='https://app.example.test/api/identity/callback', subject_hmac_key=secrets.token_bytes(32),
        client_secret=secrets.token_urlsafe(32), require_email_verified=True,
        signup_authorization_url='https://issuer.example.test/authorize?screen_hint=signup')
    double = OIDCTestDouble(config)
    app = create_app(IdentitySettings(mode='synthetic', sqlite_path=tmp_path/'return.sqlite3', oidc=config), oidc_transport=double.transport)
    with client(app) as generic, client(app) as chosen:
        for c, subject in ((generic, 'generic-return'), (chosen, 'explicit-professional-return')):
            start = c.get('/api/identity/register', params={'kind': 'professional'})
            assert start.status_code == 302
            code, state = double.issue(start.headers['location'], subject, email_verified=False)
            assert c.get('/api/identity/callback', params={'code': code, 'state': state}).status_code == 400
            assert c.get('/api/identity/session').status_code == 401

        # The generic route starts a browser-bound PKCE flow but defaults to
        # patient when no profile exists; it cannot remember the earlier intent.
        start = generic.get('/api/identity/login')
        query = parse_qs(urlsplit(start.headers['location']).query)
        assert start.status_code == 302 and query['code_challenge_method'] == ['S256']
        assert '__Host-sentra-flow=' in start.headers['set-cookie']
        code, state = double.issue(start.headers['location'], 'generic-return', email_verified=True)
        assert generic.get('/api/identity/callback', params={'code': code, 'state': state}).status_code == 303
        assert generic.get('/api/identity/session').json()['profile']['role'] == 'patient'
        # A later professional intent does not change an existing profile.
        assert sign_in(generic, double, 'generic-return', 'professional', email_verified=True)['profile']['role'] == 'patient'

        # For a fresh subject, explicitly selecting professional on first
        # successful post-verification login produces an unverified profile.
        session = sign_in(chosen, double, 'explicit-professional-return', 'professional', email_verified=True)
        assert session['profile']['role'] == 'professional' and session['profile']['verification'] == 'unverified'


def test_invalid_signed_token_never_creates_session(test_env):
    app, double, _ = test_env
    with client(app) as c:
        start = c.get('/api/identity/login')
        code, state = double.issue(start.headers['location'], 'synthetic-subject', nonce='tampered-nonce')
        result = c.get('/api/identity/callback', params={'code': code, 'state': state})
        assert result.status_code == 400 and c.get('/api/identity/session').status_code == 401
        with closing(app.state.identity_store._connect()) as conn:
            assert conn.execute('SELECT COUNT(*) FROM accounts').fetchone()[0] == 0


def test_profiles_csrf_consent_and_resource_access(test_env):
    app, double, _ = test_env
    with client(app) as a, client(app) as b, client(app) as p, client(app) as outsider:
        patient = sign_in(a, double, 'synthetic-patient-a')
        other = sign_in(b, double, 'synthetic-patient-b')
        professional = sign_in(p, double, 'synthetic-clinician', 'professional')
        other_prof = sign_in(outsider, double, 'synthetic-other-clinician', 'professional')
        patient_id, other_id, prof_id = (x['profile']['id'] for x in (patient, other, professional))
        assert a.get(f'/api/identity/profiles/{other_id}', headers={'x-role': 'administrator'}).status_code == 403
        assert p.get(f'/api/identity/profiles/{patient_id}').status_code == 403
        assert a.patch('/api/identity/profile', json={'language': 'yo'}).status_code == 403
        assert a.patch('/api/identity/profile', json={'language': 'yo'}, headers={**csrf(patient), 'origin': 'https://attacker.example.test'}).status_code == 403
        unexpected = 'unexpected-sensitive-value-do-not-echo'
        invalid = a.patch('/api/identity/profile', json={'language': 'en', 'verification': unexpected}, headers=csrf(patient))
        assert invalid.status_code == 422 and unexpected not in invalid.text
        assert a.patch('/api/identity/profile', json={'language': 'en', 'professional_category': 'doctor'}, headers=csrf(patient)).status_code == 403
        updated = p.patch('/api/identity/profile', json={'language': 'yo', 'professional_category': 'doctor'}, headers=csrf(professional))
        assert updated.status_code == 200 and updated.json()['verification'] == 'unverified'
        assert a.post('/api/identity/resources', content='do not accept any text', headers=csrf(patient)).status_code == 422
        created = a.post('/api/identity/resources', headers=csrf(patient))
        assert created.status_code == 201 and created.json()['classification'] == 'synthetic'
        rid = created.json()['id']
        assert a.get(f'/api/identity/resources/{rid}').status_code == 200
        assert b.get(f'/api/identity/resources/{rid}').status_code == 403
        assert p.get(f'/api/identity/resources/{rid}').status_code == 403
        body = {'resource_id': rid, 'recipient_id': prof_id, 'duration_days': 7}
        assert a.post('/api/identity/consents', json=body, headers=csrf(patient)).status_code == 403
        # Trusted test fixture only: no HTTP endpoint can set this status.
        with app.state.identity_store.transaction() as conn:
            conn.execute("UPDATE accounts SET verification='verified' WHERE id IN (?,?)", (prof_id, other_prof['profile']['id']))
        granted = a.post('/api/identity/consents', json=body, headers=csrf(patient))
        assert granted.status_code == 201 and granted.json()['scope'] == 'assessment:read'
        assert p.get(f'/api/identity/resources/{rid}').status_code == 200
        assert outsider.get(f'/api/identity/resources/{rid}').status_code == 403
        assert b.delete(f"/api/identity/consents/{granted.json()['id']}", headers=csrf(other)).status_code == 403
        assert a.delete(f"/api/identity/consents/{granted.json()['id']}", headers=csrf(patient)).status_code == 204
        assert p.get(f'/api/identity/resources/{rid}').status_code == 403
        assert a.get('/api/identity/consents').json()[0]['status'] == 'withdrawn'
        assert a.get('/api/identity/resources').json()[0]['id'] == rid
        with closing(app.state.identity_store._connect()) as conn:
            events = [dict(row) for row in conn.execute('SELECT * FROM audit_events').fetchall()]
            text = json.dumps(events)
            assert patient['csrf_token'] not in text and 'synthetic-patient-a' not in text
            assert any(row['action'] == 'consent.withdraw' and row['outcome'] == 'completed' for row in events)
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute('DELETE FROM audit_events')


def test_logout_expiry_and_no_store(test_env):
    app, double, clock = test_env
    with client(app) as c:
        session = sign_in(c, double, 'synthetic-user')
        token = c.cookies.get(SESSION_COOKIE)
        assert token and token not in json.dumps(session)
        assert c.post('/api/identity/logout').status_code == 403
        result = c.post('/api/identity/logout', headers=csrf(session))
        assert result.status_code == 200 and result.json()['provider_session_ended'] is False
        assert result.headers['cache-control'].startswith('no-store')
        assert c.get('/api/identity/session').status_code == 401
        c.cookies.set(SESSION_COOKIE, token, domain='app.example.test', path='/')
        assert c.get('/api/identity/session').status_code == 401
    with client(app) as c2:
        sign_in(c2, double, 'synthetic-other')
        clock.value += 301
        assert c2.get('/api/identity/session').status_code == 401


def test_storage_or_audit_failure_fails_closed_and_rolls_back(test_env, monkeypatch):
    app, double, _ = test_env
    with client(app) as c:
        session = sign_in(c, double, 'synthetic-patient')
        def fail_audit(*args, **kwargs):
            raise sqlite3.OperationalError('deliberate test failure')
        monkeypatch.setattr(app.state.identity_store, '_audit', fail_audit)
        response = c.post('/api/identity/resources', headers=csrf(session))
        assert response.status_code == 503 and response.headers['cache-control'].startswith('no-store')
        assert 'deliberate test failure' not in response.text
        with closing(app.state.identity_store._connect()) as conn:
            assert conn.execute('SELECT COUNT(*) FROM synthetic_resources').fetchone()[0] == 0
