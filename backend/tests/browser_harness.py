"""Isolated browser-test harness. NEVER import into app.main or deploy.

Runs an in-process OIDC double and a guarded synthetic-only verification
fixture. It binds only to loopback in the test runner, uses a temporary DB and
ephemeral secrets, and cannot authenticate real identities.
"""
import os
from pathlib import Path
import secrets
from typing import Literal
from urllib.parse import urlencode, urlsplit
from uuid import UUID

from fastapi import Header, HTTPException
from fastapi.responses import RedirectResponse

from app.identity.config import IdentitySettings, OIDCConfig
from app.main import create_app
from tests.oidc_double import OIDCTestDouble

if os.environ.get('SENTRA_BROWSER_TEST_ONLY') != 'ephemeral-synthetic-tests':
    raise RuntimeError('This test harness must never be used as the application server.')
database = Path(os.environ['SENTRA_BROWSER_TEST_DB'])
redirect_uri = os.environ['SENTRA_BROWSER_TEST_REDIRECT']
test_key = os.environ['SENTRA_BROWSER_TEST_KEY']
if len(test_key) < 32 or not database.is_absolute():
    raise RuntimeError('A temporary test database and random fixture key are required.')

config = OIDCConfig(issuer='https://oidc.synthetic.invalid', client_id='ephemeral-browser-test',
                    redirect_uri=redirect_uri, subject_hmac_key=secrets.token_bytes(32),
                    client_secret=secrets.token_urlsafe(40),
                    signup_authorization_url='https://oidc.synthetic.invalid/signup',
                    recovery_via_login=True, require_email_verified=True)
double = OIDCTestDouble(config)
app = create_app(IdentitySettings(mode='synthetic', sqlite_path=database, oidc=config,
                                 session_seconds=600, flow_seconds=120), oidc_transport=double.transport)


@app.get('/api/__test/authorize', include_in_schema=False)
def authorize(authorization_url: str, subject: Literal['synthetic-patient-a','synthetic-patient-b','synthetic-professional-a','synthetic-professional-b']):
    parsed = urlsplit(authorization_url)
    if parsed.scheme != 'https' or parsed.netloc != 'oidc.synthetic.invalid' or parsed.path not in {'/authorize', '/signup'}:
        raise HTTPException(status_code=400, detail='Invalid synthetic test flow.')
    try:
        # The signed boolean is produced by the test double; no email was sent
        # or verified. Actual provider/mailbox testing remains outstanding.
        code, state = double.issue(authorization_url, subject, email_verified=True, email='synthetic-browser-mailbox@example.invalid')
    except (KeyError, IndexError):
        raise HTTPException(status_code=400, detail='Invalid synthetic test flow.') from None
    return RedirectResponse('/api/identity/callback?' + urlencode({'code': code, 'state': state}), status_code=302)


@app.post('/api/__test/verify/{account_id}', include_in_schema=False)
def verify_fixture(account_id: UUID, x_synthetic_fixture_key: str = Header(default='')):
    if not secrets.compare_digest(x_synthetic_fixture_key, test_key):
        raise HTTPException(status_code=403, detail='Test fixture is not authorized.')
    # This test-only fixture is deliberately outside the real application.
    with app.state.identity_store.transaction() as conn:
        count = conn.execute("UPDATE accounts SET verification='verified' WHERE id=? AND role='professional' AND classification='synthetic'", (str(account_id),)).rowcount
    if count != 1:
        raise HTTPException(status_code=404, detail='Synthetic fixture not found.')
    return {'classification': 'synthetic', 'status': 'test-fixture-only'}
