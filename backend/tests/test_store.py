"""Synthetic-only repository tests; no real accounts or external providers."""
import json
import os
import secrets
import sqlite3
from contextlib import closing

import pytest

from app.identity.store import Conflict, Denied, SyntheticStore, csrf_for_session, subject_digest


class Clock:
    def __init__(self):
        self.value = 1_800_000_000

    def __call__(self):
        return self.value


@pytest.fixture
def setup_store(tmp_path):
    clock = Clock()
    store = SyntheticStore(tmp_path / 'synthetic.db', clock=clock)
    return store, clock, secrets.token_bytes(32)


def account(store, key, subject, intent='patient', lifetime=300, old=None):
    token, principal = store.create_session('https://issuer.example.test', subject_digest(key, 'https://issuer.example.test', subject), intent, lifetime, old)
    return token, principal


def test_versioned_store_reopens_and_rejects_unknown_schema_or_unsafe_file(tmp_path):
    path = tmp_path / 'versioned.sqlite3'
    store = SyntheticStore(path)
    with closing(store._connect()) as conn:
        assert conn.execute('PRAGMA user_version').fetchone()[0] == 1
    assert SyntheticStore(path).path == path
    with closing(store._connect()) as conn:
        conn.execute('PRAGMA user_version=999')
    with pytest.raises(ValueError, match='schema'):
        SyntheticStore(path)
    os.chmod(path, 0o644)
    with pytest.raises(ValueError, match='group or others'):
        SyntheticStore(path)
    symlink = tmp_path / 'link.sqlite3'
    symlink.symlink_to(path)
    with pytest.raises(ValueError, match='symbolic link'):
        SyntheticStore(symlink)


def test_no_privileged_self_assignment_and_opaque_subject(setup_store):
    store, _, key = setup_store
    token, patient = account(store, key, 'synthetic-patient-a')
    assert patient.role == 'patient' and patient.verification == 'not-applicable'
    _, professional = account(store, key, 'synthetic-professional', 'professional')
    assert professional.role == 'professional' and professional.verification == 'unverified'
    with pytest.raises(Denied):
        account(store, key, 'attacker', 'administrator')
    with pytest.raises(Denied):
        account(store, key, 'attacker', 'operations')
    # A different intent at later login cannot change an existing account's role.
    _, again = account(store, key, 'synthetic-patient-a', 'professional')
    assert again.id == patient.id and again.role == 'patient'
    assert store.session(token).id == patient.id
    with closing(store._connect()) as conn:
        rows = conn.execute('SELECT issuer,subject_hash FROM identities').fetchall()
        assert all('synthetic-patient-a' not in str(tuple(row)) for row in rows)
        assert all(len(row['subject_hash']) == 64 for row in rows)
    assert os.stat(store.path).st_mode & 0o077 == 0


def test_session_rotation_expiry_and_csrf(setup_store):
    store, clock, key = setup_store
    token, patient = account(store, key, 'patient')
    csrf = csrf_for_session(token)
    assert csrf == csrf_for_session(token) and csrf != token
    token2, again = account(store, key, 'patient', old=token)
    assert again.id == patient.id and token2 != token and store.session(token) is None
    assert store.session(token2).id == patient.id
    assert store.logout(token2)
    assert not store.logout(token2) and store.session(token2) is None
    token3, _ = account(store, key, 'patient', lifetime=60)
    clock.value += 60
    assert store.session(token3) is None


def test_flow_is_browser_bound_one_time_and_expires(setup_store):
    store, clock, _ = setup_store
    state, browser, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(4))
    store.begin_flow(state, browser, nonce, verifier, 'patient', 60)
    assert store.consume_flow(state, secrets.token_urlsafe(32)) is None
    flow = store.consume_flow(state, browser)
    assert flow and (flow.nonce, flow.verifier, flow.intent) == (nonce, verifier, 'patient')
    assert store.consume_flow(state, browser) is None
    store.begin_flow(state, browser, nonce, verifier, 'professional', 60)
    clock.value += 60
    assert store.consume_flow(state, browser) is None


def test_profile_ownership_and_self_verification_blocked(setup_store):
    store, _, key = setup_store
    _, patient_a = account(store, key, 'a')
    _, patient_b = account(store, key, 'b')
    _, prof = account(store, key, 'clinician', 'professional')
    with pytest.raises(Denied):
        store.read_profile(patient_a, patient_b.id)
    with pytest.raises(Denied):
        store.read_profile(prof, patient_a.id)
    with pytest.raises(Denied):
        store.update_profile(patient_a, language='en', category='doctor')
    profile = store.update_profile(prof, language='yo', category='doctor')
    assert profile['verification'] == 'unverified' and profile['professional_category'] == 'doctor'
    with closing(store._connect()) as conn:
        decisions = conn.execute("SELECT action,outcome FROM audit_events WHERE outcome='denied'").fetchall()
        assert len(decisions) >= 3


def test_administrator_does_not_inherit_patient_access(setup_store):
    store, _, key = setup_store
    _, patient = account(store, key, 'patient')
    admin_token, admin_fixture = account(store, key, 'synthetic-administrator')
    resource = store.create_resource(patient)
    # Test-only database fixture; there is no HTTP privilege-provisioning route.
    with store.transaction() as conn:
        conn.execute("UPDATE accounts SET role='administrator' WHERE id=?", (admin_fixture.id,))
    admin = store.session(admin_token)
    assert admin.role == 'administrator'
    with pytest.raises(Denied):
        store.read_profile(admin, patient.id)
    with pytest.raises(Denied):
        store.read_resource(admin, resource)
    with pytest.raises(Denied):
        store.create_resource(admin)
    with pytest.raises(Denied):
        store.grant(admin, resource, admin.id, 1)


def test_consent_scoped_to_patient_resource_recipient_and_revocation(setup_store):
    store, clock, key = setup_store
    _, owner = account(store, key, 'owner')
    _, other_patient = account(store, key, 'other-patient')
    clinician_token, pending = account(store, key, 'clinician', 'professional')
    _, second_prof = account(store, key, 'other-clinician', 'professional')
    resource = store.create_resource(owner)
    another = store.create_resource(owner)
    with pytest.raises(Denied):
        store.read_resource(other_patient, resource)
    with pytest.raises(Denied):
        store.grant(owner, resource, pending.id, 10)
    with pytest.raises(Denied):
        store.read_resource(pending, resource)
    # Test-only database fixture: no API can set real professional verification.
    with store.transaction() as conn:
        conn.execute("UPDATE accounts SET verification='verified' WHERE id IN (?,?)", (pending.id, second_prof.id))
    clinician = store.session(clinician_token)
    assert clinician.verification == 'verified'
    grant = store.grant(owner, resource, clinician.id, 1)
    assert grant['classification'] == 'synthetic' and grant['purpose'] == 'care-coordination'
    with pytest.raises(Conflict):
        store.grant(owner, resource, clinician.id, 1)
    assert store.read_resource(clinician, resource)['classification'] == 'synthetic'
    with pytest.raises(Denied):
        store.read_resource(clinician, another)
    with pytest.raises(Denied):
        store.read_resource(second_prof, resource)
    with pytest.raises(Denied):
        store.revoke_grant(other_patient, str(grant['id']))
    store.revoke_grant(owner, str(grant['id']))
    with pytest.raises(Denied):
        store.read_resource(clinician, resource)
    assert store.read_resource(owner, resource)['classification'] == 'synthetic'
    grant2 = store.grant(owner, resource, clinician.id, 1)
    clock.value += 24 * 60 * 60
    _, clinician_after_expiry = account(store, key, 'clinician', 'professional')
    assert clinician_after_expiry.verification == 'verified'
    with pytest.raises(Denied):
        store.read_resource(clinician_after_expiry, resource)
    assert grant2['expires_at'] <= clock.value


def test_stale_principal_cannot_outlive_revocation_or_verification(setup_store):
    store, _, key = setup_store
    owner_token, owner = account(store, key, 'owner')
    clinician_token, pending = account(store, key, 'professional', 'professional')
    resource = store.create_resource(owner)
    with store.transaction() as conn:
        conn.execute("UPDATE accounts SET verification='verified' WHERE id=?", (pending.id,))
    clinician = store.session(clinician_token)
    store.grant(owner, resource, clinician.id, 1)
    assert store.read_resource(clinician, resource)['classification'] == 'synthetic'
    with store.transaction() as conn:
        conn.execute("UPDATE accounts SET verification='suspended' WHERE id=?", (clinician.id,))
    with pytest.raises(Denied):
        store.read_resource(clinician, resource)
    assert store.logout(owner_token)
    with pytest.raises(Denied):
        store.read_profile(owner, owner.id)
    with pytest.raises(Denied):
        store.create_resource(owner)


def test_audit_append_only_and_minimal(setup_store):
    store, _, key = setup_store
    token, patient = account(store, key, 'synthetic-subject-never-logged')
    resource = store.create_resource(patient)
    store.read_resource(patient, resource)
    with closing(store._connect()) as conn:
        events = [dict(row) for row in conn.execute('SELECT * FROM audit_events').fetchall()]
        contents = json.dumps(events)
        assert token not in contents and 'synthetic-subject-never-logged' not in contents
        assert events and all(set(e) == {'id', 'occurred_at', 'actor_id', 'action', 'target_type', 'target_id', 'outcome'} for e in events)
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute('UPDATE audit_events SET action=? WHERE id=?', ('changed', events[0]['id']))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute('DELETE FROM audit_events WHERE id=?', (events[0]['id'],))
