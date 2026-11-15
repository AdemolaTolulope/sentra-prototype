"""OIDC authorization-code/PKCE client for explicitly configured providers.

No provider is included. The adapter accepts only HTTPS, trusted endpoint
hosts, S256 PKCE and RS256 ID tokens. Registration and recovery are
provider-specific and must be explicitly configured. Access/refresh tokens
are discarded; a separate opaque application session is used instead.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

import httpx
import jwt

from .config import OIDCConfig, require_https_url


class OIDCError(Exception):
    """The provider could not be safely used; details are not returned to clients."""


def pkce_challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')


def _authorization_url(endpoint: str, params: dict[str, str]) -> str:
    parts = urlsplit(endpoint)
    existing = parse_qsl(parts.query, keep_blank_values=True)
    if any(key in params for key, _ in existing):
        raise OIDCError('Authorization endpoint contains a reserved query parameter.')
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode([*existing, *params.items()]), ''))


class OIDCProvider:
    def __init__(self, config: OIDCConfig, *, transport: httpx.AsyncBaseTransport | None = None):
        self.config = config
        self.transport = transport  # injected only by tests; not selected by an HTTP request

    async def _json(self, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
        try:
            require_https_url(url, hosts=self.config.endpoint_hosts)
            async with httpx.AsyncClient(transport=self.transport, follow_redirects=False, timeout=8.0) as client:
                async with client.stream(method, url, headers={'Accept': 'application/json', 'Accept-Encoding': 'identity'}, **kwargs) as response:
                    if response.status_code != 200 or response.headers.get('content-encoding', 'identity').strip().lower() not in {'', 'identity'}:
                        raise OIDCError('Unexpected identity-provider response.')
                    declared = response.headers.get('content-length')
                    if declared is not None and (int(declared) < 0 or int(declared) > 256_000):
                        raise OIDCError('Identity-provider response is too large.')
                    body = bytearray()
                    # aiter_bytes also supports the in-memory test transport;
                    # compressed responses were rejected before iteration.
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 256_000:
                            raise OIDCError('Identity-provider response is too large.')
                        body.extend(chunk)
            value = json.loads(body)
            if not isinstance(value, dict):
                raise OIDCError('Invalid identity-provider response.')
            return value
        except (ValueError, httpx.HTTPError) as exc:
            raise OIDCError('Identity provider unavailable or invalid.') from exc

    async def metadata(self) -> dict[str, Any]:
        metadata = await self._json('GET', self.config.issuer.rstrip('/') + '/.well-known/openid-configuration')
        if metadata.get('issuer') != self.config.issuer:
            raise OIDCError('Identity-provider issuer does not match configuration.')
        for name in ('authorization_endpoint', 'token_endpoint', 'jwks_uri'):
            value = metadata.get(name)
            if not isinstance(value, str):
                raise OIDCError('Identity-provider metadata is incomplete.')
            try:
                require_https_url(value, hosts=self.config.endpoint_hosts)
            except ValueError as exc:
                raise OIDCError('Identity-provider endpoint is not trusted.') from exc
        methods = metadata.get('code_challenge_methods_supported')
        if not isinstance(methods, list) or 'S256' not in methods:
            raise OIDCError('The provider must advertise S256 PKCE support.')
        response_types = metadata.get('response_types_supported')
        if response_types is not None and (not isinstance(response_types, list) or 'code' not in response_types):
            raise OIDCError('Authorization-code flow is not advertised.')
        algorithms = metadata.get('id_token_signing_alg_values_supported')
        if algorithms is not None and (not isinstance(algorithms, list) or 'RS256' not in algorithms):
            raise OIDCError('RS256 ID tokens are not advertised.')
        auth_methods = metadata.get('token_endpoint_auth_methods_supported')
        if auth_methods is not None and (not isinstance(auth_methods, list) or self.config.token_auth_method not in auth_methods):
            raise OIDCError('Configured token authentication method is not advertised.')
        return metadata

    async def authorization_url(self, *, state: str, nonce: str, verifier: str, signup: bool, force_login: bool = False) -> str:
        metadata = await self.metadata()
        endpoint = self.config.signup_authorization_url if signup else metadata['authorization_endpoint']
        if not endpoint:
            raise OIDCError('Provider-specific registration is not configured.')
        try:
            require_https_url(endpoint, hosts=self.config.endpoint_hosts)
        except ValueError as exc:
            raise OIDCError('Untrusted authorization endpoint.') from exc
        params = {
            'response_type': 'code', 'client_id': self.config.client_id,
            'redirect_uri': self.config.redirect_uri,
            'scope': 'openid email' if self.config.require_email_verified else 'openid',
            'state': state, 'nonce': nonce, 'code_challenge': pkce_challenge(verifier),
            'code_challenge_method': 'S256',
        }
        if force_login:
            # Recovery begins at the provider's normal hosted login. The user
            # must choose its password-reset option; no email is sent here.
            params['prompt'] = 'login'
        return _authorization_url(endpoint, params)

    async def exchange_and_validate(self, *, code: str, verifier: str, expected_nonce: str) -> str:
        if not code or len(code) > 4096:
            raise OIDCError('Invalid authorization code.')
        metadata = await self.metadata()
        data = {'grant_type': 'authorization_code', 'code': code,
                'redirect_uri': self.config.redirect_uri, 'code_verifier': verifier}
        auth: httpx.BasicAuth | None = None
        if self.config.token_auth_method == 'client_secret_basic':
            # RFC 6749 requires form-encoding each client credential before Basic encoding.
            auth = httpx.BasicAuth(quote_plus(self.config.client_id), quote_plus(self.config.client_secret or ''))
        else:
            data['client_id'] = self.config.client_id
        response = await self._json('POST', metadata['token_endpoint'], data=data, auth=auth)
        id_token = response.get('id_token')
        if not isinstance(id_token, str) or len(id_token) > 50_000:
            raise OIDCError('No valid ID token was returned.')
        jwks = await self._json('GET', metadata['jwks_uri'])
        return self._validate_id_token(id_token, jwks, expected_nonce)

    def _validate_id_token(self, token: str, jwks: dict[str, Any], expected_nonce: str) -> str:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get('kid')
            if header.get('alg') != 'RS256' or not isinstance(kid, str) or not kid or len(kid) > 256:
                raise OIDCError('Unsupported ID token header.')
            keys = jwks.get('keys')
            if not isinstance(keys, list):
                raise OIDCError('Invalid provider keys.')
            candidates = [key for key in keys if isinstance(key, dict) and key.get('kid') == kid
                          and key.get('kty') == 'RSA' and key.get('use', 'sig') == 'sig'
                          and key.get('alg', 'RS256') == 'RS256'
                          and ('key_ops' not in key or (isinstance(key['key_ops'], list) and 'verify' in key['key_ops']))]
            if len(candidates) != 1:
                raise OIDCError('A unique trusted signing key is required.')
            key = jwt.PyJWK.from_dict(candidates[0], algorithm='RS256').key
            if getattr(key, 'key_size', 0) < 2048:
                raise OIDCError('Signing key is too small.')
            claims = jwt.decode(token, key=key, algorithms=['RS256'], audience=self.config.client_id,
                                issuer=self.config.issuer, leeway=30,
                                options={'require': ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce']})
            nonce = claims.get('nonce')
            if not isinstance(nonce, str) or not hmac.compare_digest(nonce, expected_nonce):
                raise OIDCError('ID token nonce mismatch.')
            # Optional strict gate. The email scope can return an address, but
            # only this boolean is inspected; no email address is persisted.
            if self.config.require_email_verified and claims.get('email_verified') is not True:
                raise OIDCError('Provider email verification is required.')
            audience = claims.get('aud')
            azp = claims.get('azp')
            if (isinstance(audience, list) and len(audience) > 1 and azp != self.config.client_id) or (azp is not None and azp != self.config.client_id):
                raise OIDCError('ID token authorized party mismatch.')
            subject = claims.get('sub')
            if not isinstance(subject, str) or not subject or len(subject) > 255 or not subject.isascii() or not subject.isprintable():
                raise OIDCError('ID token subject is invalid.')
            return subject
        except OIDCError:
            raise
        except (jwt.PyJWTError, ValueError, TypeError, KeyError) as exc:
            raise OIDCError('ID token validation failed.') from exc
