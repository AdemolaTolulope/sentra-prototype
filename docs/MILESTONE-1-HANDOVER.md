# Milestone 1 handover — identity and access foundation

**Status: local synthetic foundation implemented and tested; full milestone acceptance is blocked on external dependencies and user review.** No real patient or professional information is permitted. This is not production-ready, a clinical service, a security certification or a claim of legal compliance. Milestone 2 has not been started.

## What is available now

1. **Provider-neutral identity boundary.** The backend has an OIDC authorization-code adapter with S256 PKCE, state/nonce and RS256 token checks. It is configurable for one compatible local, managed or self-hosted provider at a time. The signed-email-verification gate is optional and defaults off; explicitly enable it for the Auth0 test. Auth0 is the selected first test target, but an in-process protocol double was used so far; **no external tenant is connected or verified**.
2. **Minimal server-side profiles and sessions.** Isolated SQLite contains synthetic patient/professional accounts, enum preferences and opaque server sessions. New professional accounts remain **unverified**. No public endpoint grants administrator, operations or verified-professional status. Session rotation, expiry, app-local logout and CSRF checks are implemented.
3. **Resource authorization and synthetic consent.** Owner-only profile access and fixed synthetic resources are checked server-side. A verified-professional **test fixture** can read only an explicitly granted resource for the fixed scope and purpose. Withdrawal blocks subsequent reads. This does not provide real report/referral sharing or actual clinical access.
4. **Local audit foundation.** Protected synthetic actions and decisions are recorded with opaque identifiers and fixed event codes. There is no public audit viewer. SQLite append-only triggers do not protect against a database owner, so this is not independently tamper-proof audit storage.
5. **Existing account screen connected.** The screen reads same-origin `/api` status, shows the real configuration state, supports the synthetic session/profile routes when a provider is configured, and displays synthetic example resources and consent withdrawal. The live preview has **no provider**, so sign-in, registration and recovery are disabled. Existing workspaces remain separately labelled demonstrations and are not protected by these accounts.
6. **Storage and cache boundaries.** No patient text or real records are accepted by the new resources. Session cookies are `HttpOnly`/`Secure`; CSRF values stay in memory. API responses have `no-store` and the service worker explicitly bypasses `/api`. The local DB is unencrypted and synthetic-only.

The [backend setup and configuration guide](../backend/README.md) describes every endpoint, environment variable, test command and limitation. The [security and data map](MILESTONE-1-SECURITY-AND-DATA-MAP.md) documents trust boundaries, stored fields, attack cases and residual risk. The [implementation plan](MILESTONE-1-IMPLEMENTATION-PLAN.md) retains the approved sequence and service recommendations.

## Service options — Auth0 selected for first managed test

The user selected **Auth0** as the first managed-provider validation target. No Auth0 tenant or email service is configured, and there is no Arena Auth0 connector for provisioning it. See the [managed-provider evaluation](MILESTONE-1-MANAGED-OIDC-EVALUATION.md) and [Auth0 test checklist](MILESTONE-1-AUTH0-TEST-CHECKLIST.md) for dependencies and compatibility caveats; local and self-hosted options remain supported goals.

| Decision | Options and recommendation | Dependency before claiming integration |
|---|---|---|
| Identity | A disposable local OIDC provider, a managed OIDC tenant (for example Auth0 or Amazon Cognito), or a self-hosted provider such as Keycloak. Keep the common adapter; evaluate compatibility with the current RS256/S256 and endpoint requirements for each candidate. The in-process double is **not** a deployed identity provider. | A real test tenant, registered HTTPS callback, synthetic test accounts, secret management and provider-specific interoperability/security tests. Multiple concurrent providers are not implemented. |
| Shared database | Managed or self-hosted PostgreSQL is the recommended later shared-deployment target. SQLite is only for isolated synthetic development. | Provisioned database, versioned migrations, least-privilege roles, encryption, backups, monitoring and restore tests. None is connected now. |
| Email / recovery | Prefer the selected identity provider's supported verification and recovery flows; alternatively configure an appropriate managed email service or controlled SMTP. | Provider configuration, verified sender/domain, delivery credentials and a disposable test mailbox. No app email is sent, and deliverability/abuse handling has not been tested. |

Cost, regional hosting/data residency, contracts, privacy and Nigerian legal requirements must be reviewed before any production commitment. The Auth0 choice is for a disposable test only. Do not place production secrets in the browser, source files or chat.

## Render prototype preparation — not deployed

A single-origin synthetic web-service entry, Dockerfile and free-plan Render blueprint are prepared. The frontend/API combination was tested locally, including mobile layouts and fail-closed unconfigured identity; Docker and an actual Render deployment have not been tested. The free blueprint uses ephemeral SQLite, so accounts and sessions disappear when the service spins down, restarts or redeploys. No provider is configured by default. Firebase Authentication is a possible separate future adapter, not an existing integration. See the [Render prototype guide](MILESTONE-1-RENDER-PROTOTYPE.md).

## Acceptance matrix

| Milestone check | Result |
|---|---|
| Two synthetic patients, an unverified professional and a test-only administrator are denied another patient's profile/resource; privileged roles cannot be self-assigned. | **Passed in local backend tests.** This applies only to the new synthetic API. |
| A test-only verified professional can read only a specifically granted synthetic item; withdrawal and expiry deny later reads. | **Passed with a guarded test fixture.** No real clinician verification or care relationship is connected. |
| Session expiry, rotation, local logout, CSRF, forged/invalid OIDC claims, browser-bound state, ownership and audit-on-failure. | **Passed in local tests.** Existing app sessions are not remotely introspected during a provider outage; provider logout/revocation remains outstanding. |
| Registration, sign-in, recovery, verification-email delivery and recovery-abuse tests against an actual disposable provider and mailbox. | **Not accepted.** Browser and API flows used a generated in-process OIDC double; recovery tests only demonstrate the provider-login entry or configured redirect and unconfigured failure. No email delivery or provider abuse controls were tested. |
| Preserve professional first-login intent across an external email-verification return. | **Not accepted.** The generic login/recovery entry defaults to patient for a subject without a local profile; after a failed unverified professional signup, an external generic return can therefore create the wrong synthetic profile type. A safe continuation design and real-provider test are required; see the Auth0 checklist for a test-only workaround. |
| No API or session/CSRF values in localStorage, IndexedDB or service-worker caches; offline app remains fail-closed. | **Passed for the synthetic browser test and production service worker.** Browser extensions, proxy/OS caches and other applications are outside the test. |
| Protected audit and shared durable persistence suitable for a real deployment. | **Not accepted.** Local SQLite and triggers are not independently protected, encrypted, shared or production-grade. No audit viewer, retention or secure export is provided. |
| Preserve GEOACCESS, REFLEX, MAMA-GUARD, platform and satellite functionality. | **Passed** in the synthetic regression suites listed below. No real-data or clinical validation is implied. |
| User review and authorization to proceed. | **Pending.** Do not start Milestone 2 before review and the agreed acceptance gates. |

## Checks actually run

- **Backend:** 36 synthetic tests for schema/permissions, hashed identities, current server-owned roles, object isolation including an administrator fixture, signed-token/verified-email and oversized-provider-response failure paths, PKCE/state/nonce, recovery-entry setup, the generic post-verification login-role caveat, session rotation/expiry/revocation, CSRF, scoped grants/withdrawal/expiry, append-only audit, validation-error sanitization, fail-closed storage/audit failures and the single-origin static deployment mount. The suite uses generated keys and an in-process OIDC double.
- **Clean Python setup:** an isolated virtual environment installed `backend/requirements-test.txt`; its backend tests and `pip check` passed. Dependency versions are ranges, not a locked production supply chain. The observed warnings concern Starlette's TestClient/httpx transition and a deliberately weak RSA key used to test rejection.
- **Frontend:** Node 22 typecheck, production Vite build, identity-client tests and `npm audit` passed; the audit reported zero known npm vulnerabilities at the time of the check.
- **Full synthetic browser/API test:** a self-signed temporary HTTPS proxy, ephemeral SQLite database, in-process OIDC double and guarded verification fixture exercised sign-in/registration, the explicitly enabled signed-email-claim gate and optional recovery-login entry, HttpOnly/Secure cookie, profile persistence, CSRF, unverified professional status, scoped synthetic grant and withdrawal, app logout, no-store/cache inspection and offline failure. It contacted no real identity provider or mailbox.
- **Existing core regressions:** `test:data`, `test:geo`, `test:reflex`, `test:platform` and `test:mamaguard` passed. A SHA-256 comparison against the previously delivered satellite source archive found 0 differences in 226 archived map, public-data, GEOACCESS, REFLEX and MAMA-GUARD files.
- **Existing browser regressions:** foundation, platform, GEOACCESS, REFLEX, MAMA-GUARD, satellite/globe and the Stage 4.5 cross-tab referral handoff passed, including mobile 320/390/768 px where covered. The foundation smoke reported navigation-aborted optional map/terrain requests but zero page errors. Foundation, platform, MAMA-GUARD and Stage 4.5 offline suites passed. Satellite demo imagery is subject to the source, coverage and non-commercial limitations in the existing map handover.
- **Live preview check:** same-origin status reports `synthetic-local`, `provider: unconfigured`, no real-data support and `no-store`; direct sign-in returns 503. This is an unconfigured preview, not a working real-account demonstration.

These tests are engineering checks, not a penetration test, clinical validation, provider certification or compliance determination.

## Key files

- `backend/app/identity/{config,oidc,store,routes}.py` and `backend/app/main.py` — synthetic configuration, OIDC boundary, local repository/authorization/audit and API.
- `backend/tests/` — synthetic unit/API tests and isolated provider/verification fixtures. The test harness is **not** part of the running application.
- `src/platform/AccountWorkspace.tsx` and `src/platform/services/syntheticAccount.ts` — existing account interface and same-origin, in-memory client.
- `scripts/service-worker-template.js` and `vite.config.ts` — explicit API cache exclusion and optional development/preview proxy.
- `backend/requirements-identity.txt`, `backend/requirements-test.txt`, `backend/README.md` — local dependencies and reproducible setup.
- Existing maps, synthetic modules, imagery attribution and earlier handovers remain in place.

## Remaining work before full acceptance

1. Provision and configure the selected disposable Auth0 tenant and a test mailbox; register the exact HTTPS callback and verify provider-specific registration, email verification, recovery, abuse controls, session revocation and logout. Do not put credentials in chat or the repository.
2. Provision and assess a protected shared database, reviewed migrations, encryption, secrets and backup/restore. Implement independent, access-controlled audit retention/monitoring.
3. Establish authorized professional verification and privilege provisioning; test real verification lifecycle and consent policy with appropriate governance. Do not promote synthetic fixtures to real status.
4. Complete security/privacy threat review, penetration testing, rate limiting, deployment hardening, applicable Nigerian legal review and any required DPIA before real data is considered.
5. Review this milestone with the user. Proceed to the next milestone only after the agreed acceptance tests and review are complete.
