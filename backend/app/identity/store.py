"""SQLite repository for explicitly synthetic, local-only development.

This is not an encrypted health-data store, a production database, or a
substitute for restricted database roles and independently protected audit.
"""
from __future__ import annotations

from contextlib import closing, contextmanager
from dataclasses import dataclass
import hashlib
import hmac
import os
from pathlib import Path
import secrets
import sqlite3
import time
from typing import Callable, Iterator
from uuid import uuid4

SCHEMA_VERSION = 1
LANGUAGES = frozenset({'en', 'yo', 'ha', 'ig', 'pcm'})
PROFESSIONS = frozenset({'doctor', 'dentist', 'nurse-midwife', 'pharmacist', 'laboratory-scientist', 'community-health', 'other'})


class Denied(Exception):
    """A protected operation was denied. Do not expose object existence."""


class Conflict(Exception):
    """A synthetic operation conflicts with an existing record."""


@dataclass(frozen=True)
class Principal:
    id: str
    role: str
    verification: str
    language: str
    professional_category: str | None
    expires_at: int
    session_hash: str


@dataclass(frozen=True)
class LoginFlow:
    nonce: str
    verifier: str
    intent: str


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def csrf_for_session(token: str) -> str:
    """Derived from the high-entropy HttpOnly session token; no CSRF secret is stored."""
    return hmac.new(token.encode('utf-8'), b'sentra-synthetic-csrf-v1', hashlib.sha256).hexdigest()


def subject_digest(key: bytes, issuer: str, subject: str) -> str:
    return hmac.new(key, (issuer + '\0' + subject).encode('utf-8'), hashlib.sha256).hexdigest()


def _new_id() -> str:
    return str(uuid4())


_SCHEMA = """
BEGIN IMMEDIATE;
CREATE TABLE accounts (
 id TEXT PRIMARY KEY,
 classification TEXT NOT NULL CHECK(classification='synthetic'),
 role TEXT NOT NULL CHECK(role IN ('patient','professional','operations','administrator')),
 verification TEXT NOT NULL CHECK(verification IN ('not-applicable','unverified','verified','suspended')),
 language TEXT NOT NULL CHECK(language IN ('en','yo','ha','ig','pcm')),
 professional_category TEXT,
 created_at INTEGER NOT NULL,
 disabled_at INTEGER
);
CREATE TABLE identities (
 issuer TEXT NOT NULL, subject_hash TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id),
 PRIMARY KEY(issuer, subject_hash)
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE login_flows (
 state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL,
 nonce TEXT NOT NULL, verifier TEXT NOT NULL,
 intent TEXT NOT NULL CHECK(intent IN ('patient','professional')),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE synthetic_resources (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id),
 classification TEXT NOT NULL CHECK(classification='synthetic'), created_at INTEGER NOT NULL
);
CREATE TABLE consent_grants (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id),
 recipient_id TEXT NOT NULL REFERENCES accounts(id), resource_id TEXT NOT NULL REFERENCES synthetic_resources(id),
 scope TEXT NOT NULL CHECK(scope='assessment:read'),
 purpose TEXT NOT NULL CHECK(purpose='care-coordination'),
 granted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX consent_lookup ON consent_grants(resource_id, recipient_id, scope, purpose, revoked_at, expires_at);
CREATE TABLE audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at INTEGER NOT NULL,
 actor_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT,
 outcome TEXT NOT NULL CHECK(outcome IN ('allowed','denied','completed'))
);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
PRAGMA user_version = 1;
COMMIT;
"""


class SyntheticStore:
    def __init__(self, path: Path, *, clock: Callable[[], float] = time.time):
        self.path = path
        self.clock = clock
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.path), timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys = ON')
        connection.execute('PRAGMA busy_timeout = 5000')
        return connection

    def _initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.path.is_symlink():
            raise ValueError('The synthetic database must not be a symbolic link.')
        if not self.path.exists():
            flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, 'O_NOFOLLOW', 0)
            try:
                fd = os.open(str(self.path), flags, 0o600)
                os.close(fd)
            except FileExistsError:
                if self.path.is_symlink():
                    raise ValueError('The synthetic database must not be a symbolic link.')
        if not self.path.is_file():
            raise ValueError('The synthetic database path must be a regular file.')
        if self.path.stat().st_mode & 0o077:
            raise ValueError('The synthetic database file must not be accessible by group or others.')
        with closing(self._connect()) as connection:
            version = connection.execute('PRAGMA user_version').fetchone()[0]
            if version == 0:
                connection.executescript(_SCHEMA)
            elif version != SCHEMA_VERSION:
                raise ValueError('Unsupported synthetic database schema version.')

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def now(self) -> int:
        return int(self.clock())

    def _audit(self, conn: sqlite3.Connection, actor_id: str | None, action: str,
               target_type: str, target_id: str | None, outcome: str) -> None:
        # Only fixed server-supplied codes and opaque identifiers are logged.
        conn.execute('INSERT INTO audit_events(occurred_at,actor_id,action,target_type,target_id,outcome) VALUES(?,?,?,?,?,?)',
                     (self.now(), actor_id, action, target_type, target_id, outcome))

    def audit_denial(self, actor_id: str | None, action: str, target_type: str, target_id: str | None = None) -> None:
        with self.transaction() as conn:
            self._audit(conn, actor_id, action, target_type, target_id, 'denied')

    def begin_flow(self, state: str, browser_secret: str, nonce: str, verifier: str, intent: str, lifetime: int) -> None:
        if intent not in {'patient', 'professional'}:
            raise Denied()
        now = self.now()
        with self.transaction() as conn:
            conn.execute('DELETE FROM login_flows WHERE expires_at<=?', (now,))
            conn.execute('INSERT INTO login_flows(state_hash,browser_hash,nonce,verifier,intent,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',
                         (_digest(state), _digest(browser_secret), nonce, verifier, intent, now, now + lifetime))

    def consume_flow(self, state: str, browser_secret: str) -> LoginFlow | None:
        """One-time, browser-bound state; consumption occurs before token exchange."""
        with self.transaction() as conn:
            row = conn.execute('SELECT * FROM login_flows WHERE state_hash=?', (_digest(state),)).fetchone()
            if not row or row['expires_at'] <= self.now() or not hmac.compare_digest(row['browser_hash'], _digest(browser_secret)):
                return None
            conn.execute('DELETE FROM login_flows WHERE state_hash=?', (_digest(state),))
            return LoginFlow(nonce=row['nonce'], verifier=row['verifier'], intent=row['intent'])

    def create_session(self, issuer: str, hashed_subject: str, intent: str, lifetime: int,
                       previous_token: str | None = None) -> tuple[str, Principal]:
        if intent not in {'patient', 'professional'}:
            raise Denied()
        now = self.now()
        token = secrets.token_urlsafe(32)
        with self.transaction() as conn:
            row = conn.execute('SELECT a.* FROM accounts a JOIN identities i ON i.account_id=a.id WHERE i.issuer=? AND i.subject_hash=?',
                               (issuer, hashed_subject)).fetchone()
            if row is None:
                account_id = _new_id()
                verification = 'unverified' if intent == 'professional' else 'not-applicable'
                conn.execute('INSERT INTO accounts(id,classification,role,verification,language,created_at) VALUES(?,?,?,?,?,?)',
                             (account_id, 'synthetic', intent, verification, 'en', now))
                conn.execute('INSERT INTO identities(issuer,subject_hash,account_id) VALUES(?,?,?)', (issuer, hashed_subject, account_id))
                row = conn.execute('SELECT * FROM accounts WHERE id=?', (account_id,)).fetchone()
                self._audit(conn, account_id, 'account.created', 'account', account_id, 'completed')
            if row['disabled_at'] is not None:
                raise Denied()
            if previous_token:
                conn.execute('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL', (now, _digest(previous_token)))
            expires_at = now + lifetime
            conn.execute('INSERT INTO sessions(token_hash,account_id,created_at,expires_at) VALUES(?,?,?,?)',
                         (_digest(token), row['id'], now, expires_at))
            self._audit(conn, row['id'], 'session.created', 'account', row['id'], 'completed')
            principal = Principal(row['id'], row['role'], row['verification'], row['language'], row['professional_category'], expires_at, _digest(token))
        return token, principal

    def session(self, token: str | None) -> Principal | None:
        if not token or len(token) > 256:
            return None
        with closing(self._connect()) as conn:
            row = conn.execute('SELECT a.*,s.expires_at FROM sessions s JOIN accounts a ON a.id=s.account_id '
                               'WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.disabled_at IS NULL',
                               (_digest(token), self.now())).fetchone()
            if row is None:
                return None
            return Principal(row['id'], row['role'], row['verification'], row['language'], row['professional_category'], row['expires_at'], _digest(token))

    def _current_actor(self, conn: sqlite3.Connection, actor: Principal) -> sqlite3.Row | None:
        # Recheck the session and current server-owned role inside the same
        # transaction as a protected operation, including after revocation.
        return conn.execute('SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id '
                            'WHERE s.token_hash=? AND a.id=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.disabled_at IS NULL',
                            (actor.session_hash, actor.id, self.now())).fetchone()

    def logout(self, token: str) -> bool:
        now = self.now()
        with self.transaction() as conn:
            row = conn.execute('SELECT account_id FROM sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?',
                               (_digest(token), now)).fetchone()
            if not row:
                return False
            conn.execute('UPDATE sessions SET revoked_at=? WHERE token_hash=?', (now, _digest(token)))
            self._audit(conn, row['account_id'], 'session.revoked', 'account', row['account_id'], 'completed')
            return True

    def read_profile(self, actor: Principal, target_id: str) -> dict[str, object]:
        # Ownership, not an administrator or clinician role, authorizes profile access.
        result = None
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            if not current or actor.id != target_id:
                self._audit(conn, actor.id, 'profile.read', 'account', target_id, 'denied')
            else:
                row = conn.execute('SELECT id,role,verification,language,professional_category FROM accounts WHERE id=?', (target_id,)).fetchone()
                self._audit(conn, actor.id, 'profile.read', 'account', target_id, 'allowed')
                result = dict(row)
        if result is None:
            raise Denied()
        return result

    def update_profile(self, actor: Principal, *, language: str, category: str | None) -> dict[str, object]:
        if language not in LANGUAGES or (category is not None and category not in PROFESSIONS):
            self.audit_denial(actor.id, 'profile.update', 'account', actor.id)
            raise Denied()
        result = None
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            if not current or (category is not None and current['role'] != 'professional'):
                self._audit(conn, actor.id, 'profile.update', 'account', actor.id, 'denied')
            else:
                conn.execute('UPDATE accounts SET language=?,professional_category=? WHERE id=?', (language, category, actor.id))
                row = conn.execute('SELECT id,role,verification,language,professional_category FROM accounts WHERE id=?', (actor.id,)).fetchone()
                self._audit(conn, actor.id, 'profile.update', 'account', actor.id, 'completed')
                result = dict(row)
        if result is None:
            raise Denied()
        return result

    def create_resource(self, actor: Principal) -> str:
        resource_id = _new_id()
        allowed = False
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            if not current or current['role'] != 'patient':
                self._audit(conn, actor.id, 'synthetic-resource.create', 'resource', None, 'denied')
            else:
                conn.execute('INSERT INTO synthetic_resources(id,owner_id,classification,created_at) VALUES(?,?,?,?)',
                             (resource_id, actor.id, 'synthetic', self.now()))
                self._audit(conn, actor.id, 'synthetic-resource.create', 'resource', resource_id, 'completed')
                allowed = True
        if not allowed:
            raise Denied()
        return resource_id

    def list_resources(self, actor: Principal) -> list[dict[str, object]]:
        result = None
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            if not current or current['role'] != 'patient':
                self._audit(conn, actor.id, 'synthetic-resource.list', 'account', actor.id, 'denied')
            else:
                rows = conn.execute('SELECT id,classification,created_at FROM synthetic_resources WHERE owner_id=? ORDER BY created_at DESC,id', (actor.id,)).fetchall()
                result = [dict(row) for row in rows]
                self._audit(conn, actor.id, 'synthetic-resource.list', 'account', actor.id, 'allowed')
        if result is None:
            raise Denied()
        return result

    def list_grants(self, actor: Principal) -> list[dict[str, object]]:
        result = None
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            if not current or current['role'] != 'patient':
                self._audit(conn, actor.id, 'consent.list', 'account', actor.id, 'denied')
            else:
                rows = conn.execute('SELECT id,recipient_id,resource_id,scope,purpose,granted_at,expires_at,revoked_at FROM consent_grants WHERE owner_id=? ORDER BY granted_at DESC,id', (actor.id,)).fetchall()
                result = []
                for row in rows:
                    item = dict(row)
                    item['status'] = 'withdrawn' if row['revoked_at'] is not None else 'expired' if row['expires_at'] <= self.now() else 'active'
                    item['classification'] = 'synthetic'
                    result.append(item)
                self._audit(conn, actor.id, 'consent.list', 'account', actor.id, 'allowed')
        if result is None:
            raise Denied()
        return result

    def grant(self, actor: Principal, resource_id: str, recipient_id: str, days: int) -> dict[str, object]:
        if not 1 <= days <= 90:
            self.audit_denial(actor.id, 'consent.grant', 'resource', resource_id)
            raise Denied()
        now = self.now()
        denied = False
        conflict = False
        result: dict[str, object] | None = None
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            resource = conn.execute('SELECT owner_id FROM synthetic_resources WHERE id=?', (resource_id,)).fetchone()
            recipient = conn.execute('SELECT role,verification,disabled_at FROM accounts WHERE id=?', (recipient_id,)).fetchone()
            if not current or current['role'] != 'patient' or not resource or resource['owner_id'] != actor.id or not recipient or recipient['role'] != 'professional' or recipient['verification'] != 'verified' or recipient['disabled_at'] is not None:
                self._audit(conn, actor.id, 'consent.grant', 'resource', resource_id, 'denied')
                denied = True
            else:
                active = conn.execute("SELECT id FROM consent_grants WHERE owner_id=? AND recipient_id=? AND resource_id=? AND scope='assessment:read' AND purpose='care-coordination' AND revoked_at IS NULL AND expires_at>?",
                                      (actor.id, recipient_id, resource_id, now)).fetchone()
                if active:
                    self._audit(conn, actor.id, 'consent.grant', 'consent', active['id'], 'denied')
                    conflict = True
                else:
                    grant_id = _new_id()
                    expires = now + days * 24 * 60 * 60
                    conn.execute('INSERT INTO consent_grants(id,owner_id,recipient_id,resource_id,scope,purpose,granted_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',
                                 (grant_id, actor.id, recipient_id, resource_id, 'assessment:read', 'care-coordination', now, expires))
                    self._audit(conn, actor.id, 'consent.grant', 'consent', grant_id, 'completed')
                    result = {'id': grant_id, 'resource_id': resource_id, 'recipient_id': recipient_id, 'scope': 'assessment:read', 'purpose': 'care-coordination', 'expires_at': expires, 'classification': 'synthetic'}
        if denied:
            raise Denied()
        if conflict:
            raise Conflict()
        assert result is not None
        return result

    def revoke_grant(self, actor: Principal, grant_id: str) -> None:
        denied = False
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            grant = conn.execute('SELECT owner_id,revoked_at FROM consent_grants WHERE id=?', (grant_id,)).fetchone()
            if not current or current['role'] != 'patient' or not grant or grant['owner_id'] != actor.id:
                self._audit(conn, actor.id, 'consent.withdraw', 'consent', grant_id, 'denied')
                denied = True
            elif grant['revoked_at'] is None:
                conn.execute('UPDATE consent_grants SET revoked_at=? WHERE id=?', (self.now(), grant_id))
                self._audit(conn, actor.id, 'consent.withdraw', 'consent', grant_id, 'completed')
            else:
                self._audit(conn, actor.id, 'consent.withdraw', 'consent', grant_id, 'allowed')
        if denied:
            raise Denied()

    def read_resource(self, actor: Principal, resource_id: str) -> dict[str, str]:
        """Consent and the read audit are checked in the same write-serialized transaction."""
        denied = False
        with self.transaction() as conn:
            current = self._current_actor(conn, actor)
            resource = conn.execute('SELECT id,owner_id,classification FROM synthetic_resources WHERE id=?', (resource_id,)).fetchone()
            allowed = bool(current and resource and resource['owner_id'] == actor.id and current['role'] == 'patient')
            if current and resource and not allowed and current['role'] == 'professional' and current['verification'] == 'verified':
                grant = conn.execute("SELECT id FROM consent_grants WHERE owner_id=? AND recipient_id=? AND resource_id=? AND scope='assessment:read' AND purpose='care-coordination' AND revoked_at IS NULL AND expires_at>?",
                                     (resource['owner_id'], actor.id, resource_id, self.now())).fetchone()
                allowed = bool(grant)
            self._audit(conn, actor.id, 'synthetic-resource.read', 'resource', resource_id, 'allowed' if allowed else 'denied')
            denied = not allowed
        if denied:
            raise Denied()
        return {'id': resource_id, 'classification': 'synthetic', 'content': 'Fixed synthetic demonstration resource. No patient information is present.'}
