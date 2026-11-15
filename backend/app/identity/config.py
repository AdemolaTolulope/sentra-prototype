"""Explicit synthetic-only configuration. Never print or bundle secrets."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit
import os


def require_https_url(value: str, *, hosts: frozenset[str] | None = None, allow_query: bool = True) -> str:
    """Validate trusted deployment configuration, not URLs supplied by users."""
    if not value or len(value) > 2048 or any(ord(char) <= 32 or ord(char) == 127 for char in value):
        raise ValueError('Identity URLs must not contain whitespace or control characters.')
    parsed = urlsplit(value)
    try:
        port = parsed.port  # also rejects malformed or out-of-range ports
    except ValueError as exc:
        raise ValueError('Identity URL port is invalid.') from exc
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username is not None or parsed.password is not None
            or port == 0 or parsed.netloc.endswith(':') or parsed.fragment or (not allow_query and parsed.query)):
        raise ValueError('Identity URLs must be absolute HTTPS URLs without credentials or fragments.')
    if hosts is not None and parsed.netloc.lower() not in hosts:
        raise ValueError('Identity endpoint host is not in the configured allowlist.')
    return value


@dataclass(frozen=True)
class OIDCConfig:
    issuer: str
    client_id: str
    redirect_uri: str
    subject_hmac_key: bytes = field(repr=False)
    client_secret: str | None = field(default=None, repr=False)
    token_auth_method: str = 'client_secret_basic'
    signup_authorization_url: str | None = None
    recovery_url: str | None = None
    recovery_via_login: bool = False
    require_email_verified: bool = False
    additional_endpoint_hosts: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_https_url(self.issuer, allow_query=False)
        require_https_url(self.redirect_uri, allow_query=False)
        redirect = urlsplit(self.redirect_uri)
        if redirect.path != '/api/identity/callback':
            raise ValueError('The redirect URI must end in /api/identity/callback.')
        if not self.client_id or len(self.client_id) > 256:
            raise ValueError('An OIDC client ID is required.')
        if len(self.subject_hmac_key) < 32:
            raise ValueError('The subject HMAC key must be at least 32 bytes.')
        if self.token_auth_method not in {'client_secret_basic', 'none'}:
            raise ValueError('Unsupported OIDC token endpoint authentication method.')
        if self.token_auth_method == 'client_secret_basic' and not self.client_secret:
            raise ValueError('A client secret is required for client_secret_basic.')
        if self.token_auth_method == 'none' and self.client_secret:
            raise ValueError('Do not supply a client secret when token authentication is none.')
        if not isinstance(self.recovery_via_login, bool) or not isinstance(self.require_email_verified, bool):
            raise ValueError('Provider policy switches must be boolean.')
        if self.recovery_via_login and self.recovery_url:
            raise ValueError('Choose a provider recovery URL or recovery via login, not both.')
        for host in self.additional_endpoint_hosts:
            if not host or any(ch in host for ch in '/?#@'):
                raise ValueError('Invalid identity endpoint allowlist host.')
            # Reuse strict URL/port validation and ensure this is a host only.
            require_https_url('https://' + host, allow_query=False)
        if self.signup_authorization_url:
            require_https_url(self.signup_authorization_url, hosts=self.endpoint_hosts)
        if self.recovery_url:
            require_https_url(self.recovery_url, hosts=self.endpoint_hosts)

    @property
    def endpoint_hosts(self) -> frozenset[str]:
        return frozenset([urlsplit(self.issuer).netloc.lower(), *(host.lower() for host in self.additional_endpoint_hosts)])


@dataclass(frozen=True)
class IdentitySettings:
    mode: str = 'disabled'
    sqlite_path: Path | None = None
    oidc: OIDCConfig | None = None
    session_seconds: int = 8 * 60 * 60
    flow_seconds: int = 10 * 60

    def __post_init__(self) -> None:
        if self.mode not in {'disabled', 'synthetic'}:
            raise ValueError('Only disabled or synthetic identity modes exist; production is not supported.')
        if self.mode == 'disabled' and (self.sqlite_path is not None or self.oidc is not None):
            raise ValueError('Disabled identity mode cannot configure a store or provider.')
        if self.mode == 'synthetic' and self.sqlite_path is None:
            raise ValueError('Synthetic mode requires an explicit local SQLite path.')
        if self.sqlite_path is not None and (str(self.sqlite_path) == ':memory:' or not self.sqlite_path.is_absolute()):
            raise ValueError('Use an absolute file path for the local synthetic SQLite store.')
        if not 60 <= self.session_seconds <= 24 * 60 * 60:
            raise ValueError('Session lifetime must be between one minute and one day.')
        if not 60 <= self.flow_seconds <= 15 * 60:
            raise ValueError('Login flow lifetime must be between one and fifteen minutes.')

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None) -> 'IdentitySettings':
        env = dict(os.environ if environ is None else environ)
        mode = env.get('SENTRA_IDENTITY_MODE', 'disabled').strip().lower()
        if mode == 'disabled':
            if any(env.get(key) for key in env if key.startswith('SENTRA_OIDC_')) or env.get('SENTRA_SYNTHETIC_DB') or env.get('SENTRA_SUBJECT_HMAC_KEY'):
                raise ValueError('Configure the synthetic mode explicitly before identity settings.')
            return cls()
        if mode != 'synthetic':
            raise ValueError('Only disabled or synthetic identity modes exist; production is not supported.')
        db = env.get('SENTRA_SYNTHETIC_DB', '').strip()
        if not db:
            raise ValueError('SENTRA_SYNTHETIC_DB is required in synthetic mode.')
        required = ('SENTRA_OIDC_ISSUER', 'SENTRA_OIDC_CLIENT_ID', 'SENTRA_OIDC_REDIRECT_URI', 'SENTRA_SUBJECT_HMAC_KEY')
        provided = [bool(env.get(key, '').strip()) for key in required]
        provider_options = ('SENTRA_OIDC_CLIENT_SECRET', 'SENTRA_OIDC_SIGNUP_URL', 'SENTRA_OIDC_RECOVERY_URL', 'SENTRA_OIDC_RECOVERY_VIA_LOGIN', 'SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED', 'SENTRA_OIDC_ENDPOINT_HOSTS', 'SENTRA_OIDC_TOKEN_AUTH_METHOD')
        if any(provided) and not all(provided):
            raise ValueError('OIDC configuration is incomplete; do not start a partially configured provider.')
        if not any(provided) and any(env.get(key, '').strip() for key in provider_options):
            raise ValueError('OIDC options require the complete provider configuration.')
        oidc = None
        if all(provided):
            auth_method = env.get('SENTRA_OIDC_TOKEN_AUTH_METHOD', 'client_secret_basic').strip()
            def policy_flag(name: str, *, default: str = 'false') -> bool:
                value = env.get(name, default).strip().lower()
                if value not in {'true', 'false'}:
                    raise ValueError(f'{name} must be true or false.')
                return value == 'true'
            oidc = OIDCConfig(
                issuer=env['SENTRA_OIDC_ISSUER'].strip(),
                client_id=env['SENTRA_OIDC_CLIENT_ID'].strip(),
                redirect_uri=env['SENTRA_OIDC_REDIRECT_URI'].strip(),
                subject_hmac_key=env['SENTRA_SUBJECT_HMAC_KEY'].encode('utf-8'),
                client_secret=env.get('SENTRA_OIDC_CLIENT_SECRET') or None,
                token_auth_method=auth_method,
                signup_authorization_url=env.get('SENTRA_OIDC_SIGNUP_URL') or None,
                recovery_url=env.get('SENTRA_OIDC_RECOVERY_URL') or None,
                recovery_via_login=policy_flag('SENTRA_OIDC_RECOVERY_VIA_LOGIN'),
                require_email_verified=policy_flag('SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED'),
                additional_endpoint_hosts=tuple(host.strip() for host in env.get('SENTRA_OIDC_ENDPOINT_HOSTS', '').split(',') if host.strip()),
            )
        return cls(mode='synthetic', sqlite_path=Path(db), oidc=oidc)
