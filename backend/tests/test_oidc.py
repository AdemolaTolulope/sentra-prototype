"""OIDC protocol tests use generated keys and an in-process HTTP double only."""
import asyncio
from dataclasses import replace
import json
import secrets
import time
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.identity.config import IdentitySettings, OIDCConfig
from app.identity.oidc import OIDCError, OIDCProvider, pkce_challenge

ISSUER = 'https://issuer.example.test'


@pytest.fixture(scope='module')
def keypair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    jwk.update({'kid': 'synthetic-signing-key', 'use': 'sig', 'alg': 'RS256'})
    return private, jwk


@pytest.fixture
def config():
    return OIDCConfig(issuer=ISSUER, client_id='synthetic-client', redirect_uri='https://app.example.test/api/identity/callback',
                      subject_hmac_key=secrets.token_bytes(32), client_secret=secrets.token_urlsafe(32),
                      signup_authorization_url=ISSUER + '/signup?screen_hint=signup', recovery_url=ISSUER + '/recover')


def metadata():
    return {'issuer': ISSUER, 'authorization_endpoint': ISSUER + '/authorize', 'token_endpoint': ISSUER + '/token',
            'jwks_uri': ISSUER + '/keys', 'code_challenge_methods_supported': ['S256'],
            'response_types_supported': ['code'], 'id_token_signing_alg_values_supported': ['RS256'],
            'token_endpoint_auth_methods_supported': ['client_secret_basic']}


def signed(private, config, **changes):
    now = int(time.time())
    claims = {'iss': ISSUER, 'sub': 'synthetic-subject', 'aud': config.client_id, 'iat': now,
              'exp': now + 300, 'nonce': 'synthetic-nonce'}
    claims.update(changes)
    return jwt.encode(claims, private, algorithm='RS256', headers={'kid': 'synthetic-signing-key'})


def test_configuration_fails_closed(tmp_path):
    assert IdentitySettings.from_environment({}).mode == 'disabled'
    with pytest.raises(ValueError):
        IdentitySettings.from_environment({'SENTRA_IDENTITY_MODE': 'production'})
    with pytest.raises(ValueError):
        IdentitySettings.from_environment({'SENTRA_IDENTITY_MODE': 'synthetic', 'SENTRA_SYNTHETIC_DB': str(tmp_path/'db'), 'SENTRA_OIDC_ISSUER': ISSUER})
    with pytest.raises(ValueError):
        OIDCConfig(issuer='http://issuer.example.test', client_id='x', redirect_uri='https://app.example.test/api/identity/callback',
                   subject_hmac_key=secrets.token_bytes(32), client_secret=secrets.token_urlsafe(32))
    with pytest.raises(ValueError):
        OIDCConfig(issuer=ISSUER, client_id='x', redirect_uri='https://app.example.test/api/identity/callback',
                   subject_hmac_key=secrets.token_bytes(32), client_secret=secrets.token_urlsafe(32), recovery_url='https://other.example.test/recover')
    with pytest.raises(ValueError):
        IdentitySettings.from_environment({'SENTRA_SUBJECT_HMAC_KEY': secrets.token_urlsafe(32)})
    for bad_issuer in ('https://@issuer.example.test', 'https://issuer.example.test:invalid', 'https://issuer.example.test:0', 'https://issuer.example.test/\nheader'):
        with pytest.raises(ValueError):
            OIDCConfig(issuer=bad_issuer, client_id='x', redirect_uri='https://app.example.test/api/identity/callback',
                       subject_hmac_key=secrets.token_bytes(32), client_secret=secrets.token_urlsafe(32))


def test_email_gate_and_recovery_policy_configuration(config, tmp_path):
    with pytest.raises(ValueError, match='recovery'):
        replace(config, recovery_via_login=True)
    values = {'SENTRA_IDENTITY_MODE': 'synthetic', 'SENTRA_SYNTHETIC_DB': str(tmp_path/'db'),
              'SENTRA_OIDC_ISSUER': ISSUER, 'SENTRA_OIDC_CLIENT_ID': 'synthetic-client',
              'SENTRA_OIDC_REDIRECT_URI': 'https://app.example.test/api/identity/callback',
              'SENTRA_SUBJECT_HMAC_KEY': secrets.token_urlsafe(32), 'SENTRA_OIDC_CLIENT_SECRET': secrets.token_urlsafe(32),
              'SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED': 'true', 'SENTRA_OIDC_RECOVERY_VIA_LOGIN': 'true'}
    configured = IdentitySettings.from_environment(values)
    assert configured.oidc.require_email_verified and configured.oidc.recovery_via_login
    defaults = {key: value for key, value in values.items() if key != 'SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED'}
    assert not IdentitySettings.from_environment(defaults).oidc.require_email_verified
    assert not IdentitySettings.from_environment({**defaults, 'SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED': 'false'}).oidc.require_email_verified
    with pytest.raises(ValueError, match='true or false'):
        IdentitySettings.from_environment({**values, 'SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED': 'maybe'})
    with pytest.raises(ValueError, match='recovery'):
        IdentitySettings.from_environment({**values, 'SENTRA_OIDC_RECOVERY_URL': ISSUER + '/recover'})


def test_config_repr_does_not_expose_secrets(config):
    value = repr(config)
    assert config.client_secret not in value and repr(config.subject_hmac_key) not in value


def test_pkce_matches_published_vector():
    assert pkce_challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk') == 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'


def test_authorization_and_exchange_validate_signed_token(config, keypair):
    private, public = keypair
    verifier = secrets.token_urlsafe(64)
    seen = []
    def handler(request):
        seen.append((request.method, request.url.path))
        if request.url.path.endswith('/.well-known/openid-configuration'):
            return httpx.Response(200, json=metadata())
        if request.url.path == '/token':
            values = parse_qs(request.content.decode())
            assert values['grant_type'] == ['authorization_code'] and values['code_verifier'] == [verifier]
            assert values['redirect_uri'] == [config.redirect_uri]
            assert request.headers['authorization'].startswith('Basic ')
            return httpx.Response(200, json={'id_token': signed(private, config), 'access_token': 'discarded-test-token'})
        if request.url.path == '/keys':
            return httpx.Response(200, json={'keys': [public]})
        return httpx.Response(404)
    provider = OIDCProvider(config, transport=httpx.MockTransport(handler))
    url = asyncio.run(provider.authorization_url(state='state', nonce='synthetic-nonce', verifier=verifier, signup=False))
    query = parse_qs(urlsplit(url).query)
    assert query['code_challenge'] == [pkce_challenge(verifier)] and query['code_challenge_method'] == ['S256']
    assert query['state'] == ['state'] and query['nonce'] == ['synthetic-nonce'] and query['scope'] == ['openid']
    signup = asyncio.run(provider.authorization_url(state='state', nonce='synthetic-nonce', verifier=verifier, signup=True))
    assert parse_qs(urlsplit(signup).query)['screen_hint'] == ['signup']
    subject = asyncio.run(provider.exchange_and_validate(code='synthetic-code', verifier=verifier, expected_nonce='synthetic-nonce'))
    assert subject == 'synthetic-subject' and ('POST', '/token') in seen


def test_opt_in_verified_email_gate_checks_signed_boolean(config, keypair):
    private, public = keypair
    strict = replace(config, recovery_url=None, recovery_via_login=True, require_email_verified=True)
    provider = OIDCProvider(strict, transport=httpx.MockTransport(lambda _request: httpx.Response(200, json=metadata())))
    url = asyncio.run(provider.authorization_url(state='state', nonce='synthetic-nonce', verifier=secrets.token_urlsafe(64), signup=False, force_login=True))
    query = parse_qs(urlsplit(url).query)
    assert query['scope'] == ['openid email'] and query['prompt'] == ['login'] and query['code_challenge_method'] == ['S256']
    assert provider._validate_id_token(signed(private, strict, email_verified=True, email='synthetic@example.invalid'), {'keys': [public]}, 'synthetic-nonce') == 'synthetic-subject'
    for changes in ({}, {'email_verified': False}, {'email_verified': 'true'}, {'email_verified': 1}):
        with pytest.raises(OIDCError):
            provider._validate_id_token(signed(private, strict, **changes), {'keys': [public]}, 'synthetic-nonce')
    # This compatibility mode is synthetic-only; the planned Auth0 test enables the gate.
    relaxed = OIDCProvider(replace(strict, require_email_verified=False))
    assert relaxed._validate_id_token(signed(private, strict), {'keys': [public]}, 'synthetic-nonce') == 'synthetic-subject'


@pytest.mark.parametrize('changes', [
    {'iss': 'https://other.example.test'}, {'aud': 'wrong-client'}, {'nonce': 'wrong-nonce'},
    {'exp': 1}, {'iat': 1, 'exp': 2}, {'sub': ''}, {'aud': ['synthetic-client', 'another-client']},
    {'azp': 'wrong-client'},
])
def test_rejects_invalid_claims(config, keypair, changes):
    private, public = keypair
    provider = OIDCProvider(config)
    with pytest.raises(OIDCError):
        provider._validate_id_token(signed(private, config, **changes), {'keys': [public]}, 'synthetic-nonce')


def test_rejects_untrusted_or_ambiguous_keys(config, keypair):
    private, public = keypair
    provider = OIDCProvider(config)
    token = signed(private, config)
    for keys in ([], [public, public], [{**public, 'kid': 'other'}], [{**public, 'use': 'enc'}]):
        with pytest.raises(OIDCError):
            provider._validate_id_token(token, {'keys': keys}, 'synthetic-nonce')
    weak = rsa.generate_private_key(public_exponent=65537, key_size=1024)
    weak_public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(weak.public_key()))
    weak_public.update({'kid': 'synthetic-signing-key', 'use': 'sig', 'alg': 'RS256'})
    with pytest.raises(OIDCError):
        provider._validate_id_token(signed(weak, config), {'keys': [weak_public]}, 'synthetic-nonce')


def test_oversized_or_compressed_provider_responses_are_rejected(config):
    class LargeStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            for _ in range(3):
                yield b'x' * 100_000

    def oversized(request):
        assert request.headers['accept-encoding'] == 'identity'
        return httpx.Response(200, stream=LargeStream(), headers={'content-type': 'application/json'})

    provider = OIDCProvider(config, transport=httpx.MockTransport(oversized))
    with pytest.raises(OIDCError):
        asyncio.run(provider.metadata())
    compressed = OIDCProvider(config, transport=httpx.MockTransport(
        lambda _request: httpx.Response(200, stream=LargeStream(), headers={'content-encoding': 'gzip'})))
    with pytest.raises(OIDCError):
        asyncio.run(compressed.metadata())


def test_provider_failures_and_untrusted_metadata_fail_closed(config):
    variants = [
        {**metadata(), 'issuer': 'https://other.example.test'},
        {**metadata(), 'token_endpoint': 'https://other.example.test/token'},
        {**metadata(), 'code_challenge_methods_supported': ['plain']},
    ]
    for invalid in variants:
        provider = OIDCProvider(config, transport=httpx.MockTransport(lambda request, invalid=invalid: httpx.Response(200, json=invalid)))
        with pytest.raises(OIDCError):
            asyncio.run(provider.metadata())
    redirecting = OIDCProvider(config, transport=httpx.MockTransport(lambda request: httpx.Response(302, headers={'Location': 'https://other.example.test/'})))
    with pytest.raises(OIDCError):
        asyncio.run(redirecting.metadata())
    unavailable = OIDCProvider(config, transport=httpx.MockTransport(lambda request: (_ for _ in ()).throw(httpx.ConnectError('unavailable'))))
    with pytest.raises(OIDCError):
        asyncio.run(unavailable.metadata())
