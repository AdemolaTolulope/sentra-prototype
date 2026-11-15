"""In-process OIDC protocol double. It is not an identity service or deployment."""
import json
import secrets
import time
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from app.identity.oidc import pkce_challenge


class OIDCTestDouble:
    def __init__(self, config):
        self.config = config
        self.private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(self.private.public_key()))
        self.public.update({'kid': 'test-key', 'alg': 'RS256', 'use': 'sig'})
        self.codes = {}
        self.calls = []
        self.transport = httpx.MockTransport(self.handle)

    def issue(self, redirect_url, subject, **claims):
        query = parse_qs(urlsplit(redirect_url).query)
        code = secrets.token_urlsafe(32)
        self.codes[code] = {'challenge': query['code_challenge'][0], 'nonce': query['nonce'][0], 'sub': subject, 'claims': claims}
        return code, query['state'][0]

    def handle(self, request):
        self.calls.append((request.method, request.url.path))
        issuer = self.config.issuer
        if request.url.path.endswith('/.well-known/openid-configuration'):
            return httpx.Response(200, json={'issuer': issuer, 'authorization_endpoint': issuer + '/authorize',
                'token_endpoint': issuer + '/token', 'jwks_uri': issuer + '/keys',
                'code_challenge_methods_supported': ['S256'], 'response_types_supported': ['code'],
                'id_token_signing_alg_values_supported': ['RS256'],
                'token_endpoint_auth_methods_supported': [self.config.token_auth_method]})
        if request.url.path == '/token':
            data = parse_qs(request.content.decode())
            code = data.get('code', [''])[0]
            item = self.codes.pop(code, None)
            if not item or data.get('redirect_uri') != [self.config.redirect_uri] or pkce_challenge(data.get('code_verifier', [''])[0]) != item['challenge']:
                return httpx.Response(400, json={'error': 'invalid_grant'})
            now = int(time.time())
            claims = {'iss': issuer, 'sub': item['sub'], 'aud': self.config.client_id, 'iat': now,
                      'exp': now + 300, 'nonce': item['nonce'], **item['claims']}
            token = jwt.encode(claims, self.private, algorithm='RS256', headers={'kid': 'test-key'})
            return httpx.Response(200, json={'id_token': token, 'access_token': 'discarded-synthetic-token'})
        if request.url.path == '/keys':
            return httpx.Response(200, json={'keys': [self.public]})
        return httpx.Response(404)
