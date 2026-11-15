# Milestone 1 implementation plan — identity and access foundation

**Status:** local synthetic implementation and regression checks completed; full acceptance is pending a real disposable provider, test mailbox, protected shared persistence and user review. This is not a real-patient or production deployment. The previously delivered modules and satellite map remain in place. See [the handover](MILESTONE-1-HANDOVER.md) and [security/data map](MILESTONE-1-SECURITY-AND-DATA-MAP.md) for implemented details and remaining gates.

## Service choices and dependencies

A managed Auth0 tenant was selected as the first **test target** after local implementation. No Auth0 tenant, production identity service, database host or email service is configured; local and self-hosted provider options remain in scope. See the [managed-provider evaluation](MILESTONE-1-MANAGED-OIDC-EVALUATION.md).

| Component | Options | Recommendation and dependency |
|---|---|---|
| Identity | Disposable local OIDC provider; managed OIDC service such as Auth0 or Amazon Cognito; or self-hosted Keycloak. | Use one standards-based server-side adapter, not a vendor-specific frontend login. Evaluate each candidate's compatibility with the current RS256/S256 implementation. A real test tenant, registered HTTPS redirect URI and provider configuration are required. OIDC does not itself standardize all sign-up and recovery screens. Auth0 is the first validation target, but no tenant is configured or connected; only one provider is configurable at a time. |
| Database | Managed/self-hosted PostgreSQL; local SQLite for isolated development and tests. | PostgreSQL is the recommended shared-deployment target. Use SQLite **only** for synthetic local work, clearly gated as non-production. PostgreSQL, container tooling, migrations and deployment controls are needed before a shared or real-data environment. |
| Email | Identity-provider-hosted verification/recovery, SMTP, or a managed email API. | Prefer the selected identity provider's supported flows. A verified sender, delivery service, credentials and test mailbox are needed. No email is sent while these are unconfigured. |

The current execution environment has no Docker/Podman or PostgreSQL service. The implementation will use a disposable local SQLite test database and a **test-only OIDC protocol double** to exercise security logic; neither is represented as an external integration. A real disposable provider and mailbox remain a milestone acceptance dependency.

## Implementation sequence

1. **Configuration and security contracts:** explicit synthetic-only mode, deny-by-default startup, provider status, OIDC authorization-code/PKCE boundaries, server sessions and a no-store API policy.
2. **Local persistence:** versioned synthetic-only account/profile, session, consent, resource and append-only audit structures. No patient details, passwords, tokens or raw clinical information are required for the local demo.
3. **Enforcement:** server-owned roles, ownership and resource checks, consent grant/withdrawal, CSRF protection, session expiry/revocation, audit on protected actions and explicit professional `unverified` status. No public endpoint grants administrator or verified-clinician status.
4. **Existing account UI:** use relative same-origin API calls, report the backend/provider's actual configuration, show an authenticated synthetic profile when a genuinely configured provider is used, and keep unavailable registration/recovery controls disabled. Do not put session secrets or health data in browser storage.
5. **Validation:** backend unit and integration tests for OIDC failure paths, sessions, consent, authorization and audit; browser tests for unconfigured behavior and no-cache boundaries; existing GEOACCESS/REFLEX/MAMA-GUARD and satellite regressions where applicable. Document which acceptance checks require a real provider, mailbox and database.

## Proposed file changes

- `backend/app/main.py`: retain `/health`, add the new API through isolated modules.
- `backend/app/identity/`: configuration, OIDC boundary, server-side session, synthetic repository/migrations, policy, consent and audit services/routes.
- `backend/tests/`: synthetic-only tests, ephemeral keys and a test-only OIDC double; no seeded real users or embedded credentials.
- `backend/requirements*.txt` and `backend/README.md`: minimum new dependencies, configuration and reproducible setup; document provider, database and email status.
- `src/platform/AccountWorkspace.tsx`, `src/platform/services/identity.ts`, associated styling: connect the existing interface to `/api` without trusting frontend authorization.
- `vite.config.ts`: optional server-side `/api` proxy for local development/preview; browser code remains same-origin and never calls localhost.
- `scripts/`: targeted identity browser checks and regression coverage; `docs/` and a milestone handover describe implementation and limitations.

## Acceptance and stop point

The implementation must fail closed when the identity provider or storage is unavailable. Synthetic cross-account access, privilege escalation, CSRF, session expiration/logout, consent withdrawal, audit integrity and no-cache checks must pass. Existing synthetic modules must continue to work. An actual provider registration/recovery test, test mailbox and production-grade persistence are explicitly pending until configured; the milestone cannot be represented as fully accepted or production-ready before those checks. Do not start Milestone 2.
