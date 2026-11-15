# senTRA backend — synthetic identity foundation

**Synthetic development and tests only. Never enter or deploy this backend with real patient, professional or other sensitive information.** This is not a production healthcare service, an independently reviewed security product, a FHIR server or a regulatory-compliance claim.

The original FastAPI scaffold and its `/health` endpoint remain. Milestone 1 adds a narrow identity/access API for **fixed synthetic examples only**. No identity provider, PostgreSQL server, professional verification service, mailbox or email sender is bundled or connected by default. The existing GEOACCESS, REFLEX and MAMA-GUARD demos do not use this API and are not protected by it.

## What is implemented

- Explicit `disabled` (default) and `synthetic` modes. Synthetic mode requires an absolute local SQLite path; no production mode exists. Version 1 of the synthetic schema is bootstrapped and unknown schema versions fail closed. This is not a general-purpose production migration system.
- One provider-neutral OIDC adapter for a compatible local, managed or self-hosted provider. It supports authorization code with S256 PKCE, browser-bound one-time state and nonce, HTTPS and explicitly allowlisted provider endpoint hosts. It validates RS256 signatures and the issuer, audience, expiry, issued-at time, nonce and authorized-party claims. An optional strict policy also requires the signed `email_verified` claim to be exactly `true`. Provider access/refresh tokens and raw subjects are not persisted. Only one provider is configurable at a time; actual provider compatibility has not been demonstrated.
- Minimal synthetic patient and professional profiles. The server assigns only `patient` or `professional` on first sign-in; a professional starts `unverified`. Later login intent and provider-supplied roles cannot change the stored role. There is no public administrator, operations or professional-verification provisioning endpoint.
- A random opaque server-side session, hashed at rest, with rotation at sign-in, expiry, local revocation, a `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` cookie and CSRF token checks on mutations. The app signs out its own session only; provider logout/revocation is not connected.
- Object-level checks against the current server session and account: patients may access their own profiles and fixed synthetic resources. A professional must have current `verified` status and a matching owner, recipient, resource, `assessment:read` scope, `care-coordination` purpose, unexpired and unwithdrawn grant. Administrators have no automatic patient access. Authorization, grant withdrawal and the related access audit are performed in serialized SQLite transactions.
- Purpose/recipient/resource-scoped synthetic grants and withdrawal, and minimal opaque, append-only local audit events. No HTTP audit viewer exists. SQLite triggers prevent normal event updates/deletes, but a database owner can remove the triggers or rewrite the file: this is **not** independently protected or tamper-proof audit storage.
- Same-origin `/api/identity/*` routes, sanitized validation errors, `Cache-Control: no-store` on `/api/*`, and a service-worker exclusion for `/api`. No patient record, free-text clinical resource, password, clinical AI or real sharing route exists.

**Tests only:** `backend/tests/oidc_double.py` generates ephemeral signing keys and simulates OIDC responses in-process. `backend/tests/browser_harness.py` is a separate, guarded, loopback-only test harness with a test-only synthetic verification fixture. Neither is imported by `app.main` or an identity provider. Never deploy the test harness.

## Local setup without a provider

From the project root, with Python 3.11+ (tested with 3.13) and Node 22+ installed:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-test.txt
mkdir -p .synthetic-data && chmod 700 .synthetic-data

# Terminal 1: no provider, no real identities. The DB is unencrypted.
cd backend
SENTRA_IDENTITY_MODE=synthetic \
SENTRA_SYNTHETIC_DB="$(cd .. && pwd)/.synthetic-data/identity.sqlite3" \
../.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8019 --no-access-log
```

In a second terminal at the project root:

```bash
npm ci
SENTRA_API_PROXY_TARGET=http://127.0.0.1:8019 npm run dev -- --port 5186
# Browser: http://localhost:5186/#/account
```

The proxy target is used by Vite **on the server**; browser code calls only relative `/api` URLs. The account screen should report the synthetic store and **provider not configured**, with sign-in, registration and recovery disabled. `GET /api/identity/status` returns configuration status; `/api/identity/login` returns 503. `/health` indicates whether OIDC settings are present, not whether a provider is healthy. Without the proxy/backend, the account screen shows the backend as unavailable and remains locked. Existing public/synthetic frontend modules still work without a backend.

New SQLite files are created with mode `0600`, and files accessible by group or others are rejected. Protect the containing directory and machine. `.synthetic-data/` and common database files are ignored by Git, but `.gitignore` is **not encryption or access control**; SQLite journals, snapshots and backups can retain data. Delete disposable databases when no longer needed. SQLite is not appropriate for shared/production use or real health information.

## Single-origin Render prototype — prepared, not deployed

After building `dist/` at the project root, `app.render_entry:app` mounts that compiled frontend after the existing API routes. The root `Dockerfile` and `render.yaml` prepare a single free Render service, but neither the Docker image nor an actual Render deployment has been tested here. No identity provider is configured by the blueprint. Free-host SQLite is ephemeral and is lost on spin-down, restart or redeploy; real data is prohibited. See the [Render prototype guide](../docs/MILESTONE-1-RENDER-PROTOTYPE.md).

## Optional OIDC configuration — not supplied or verified

A separately operated **disposable synthetic** OIDC provider needs a registered HTTPS callback exactly matching the externally reachable frontend origin plus `/api/identity/callback`. The application cannot prove that an external identity is fictional: never connect real user accounts. Secure cookies and real redirects require HTTPS; the local test suite uses a temporary localhost certificate. Use a secret manager, not a checked-in file or frontend variable. Never paste production credentials into chat or commit secrets.

| Variable | Purpose |
|---|---|
| `SENTRA_IDENTITY_MODE` | Must be `synthetic`; default is `disabled`. |
| `SENTRA_SYNTHETIC_DB` | Absolute path to an isolated local SQLite file. |
| `SENTRA_OIDC_ISSUER` | Exact HTTPS OIDC issuer. |
| `SENTRA_OIDC_CLIENT_ID` | Registered synthetic test client. |
| `SENTRA_OIDC_REDIRECT_URI` | Exact HTTPS frontend-origin callback ending `/api/identity/callback`. |
| `SENTRA_SUBJECT_HMAC_KEY` | Stable, independently generated high-entropy secret of at least 32 UTF-8 bytes. Changing it changes account mappings; a safe key-rotation/migration process is not implemented. |
| `SENTRA_OIDC_CLIENT_SECRET` | Required for the default `client_secret_basic`; stored only in the server environment. |
| `SENTRA_OIDC_TOKEN_AUTH_METHOD` | `client_secret_basic` (default) or `none` for a compatible public client. |
| `SENTRA_OIDC_ENDPOINT_HOSTS` | Optional comma-separated additional trusted `host[:port]` values for provider endpoints; the issuer host is already allowed. Treat this list and DNS/egress configuration as security-sensitive. |
| `SENTRA_OIDC_SIGNUP_URL` | Optional provider-specific HTTPS authorization endpoint that supports registration with OIDC parameters; registration is disabled if absent. |
| `SENTRA_OIDC_RECOVERY_URL` | Optional direct provider-hosted HTTPS recovery page. Cannot be combined with `SENTRA_OIDC_RECOVERY_VIA_LOGIN=true`. |
| `SENTRA_OIDC_RECOVERY_VIA_LOGIN` | `true` starts a state-bound, PKCE-protected provider login with `prompt=login`, where the user may choose the provider's recovery option. Default `false`; no email or reset is performed by this app. |
| `SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED` | Default `false`. Set `true` for the planned Auth0 test: requests `openid email` and rejects ID tokens unless the signed `email_verified` claim is exactly `true`. The returned email address is transient and not stored; use only synthetic test identities. |

Partial or invalid provider configuration fails startup. Discovery endpoints must use HTTPS, be on the allowlist and advertise S256; the adapter currently accepts RS256 ID tokens only. Provider JSON responses are streamed with a 256,000-byte limit, request identity encoding and reject compressed responses; compatibility with an actual provider is untested. By default the app requests only `openid`; the optional email-verification gate additionally requests `email` and checks the provider's signed boolean without storing the address. Set the gate to `true` for the planned Auth0 test. This app does not send mail. Provider sign-up, actual email verification, recovery behaviour, deliverability, abuse controls and compatible logout must be tested separately against the selected provider and a test mailbox. A configured status means settings exist, **not** that a provider has been reached or independently validated.

Removing provider configuration disables access to stored sessions. If a configured provider later becomes unavailable, **new logins fail**, but already-issued app sessions are not remotely introspected and can remain valid until local expiry/revocation. External identity revocation, single logout, reauthentication, rate limits and recovery-abuse controls remain outstanding.

## API outline

- `GET /api/identity/status`, `/login`, `/register`, `/recovery`, `/callback` — configuration and provider entry points; unconfigured capabilities fail closed.
- `GET /api/identity/session`, `POST /api/identity/logout` — synthetic app session. The CSRF value returned with a session belongs in memory only.
- `GET /api/identity/profiles/{id}`, `PATCH /api/identity/profile` — owner-only minimal profile and selected enum fields; extra fields and role/verification updates are rejected.
- `GET/POST /api/identity/resources`, `GET /api/identity/resources/{id}` — fixed synthetic resources only; creation accepts no content.
- `GET/POST /api/identity/consents`, `DELETE /api/identity/consents/{id}` — owner-scoped synthetic grants. New grants require a verified professional. No production verification process or UI for creating such a grant exists.
- There is intentionally **no public audit endpoint**. API errors do not expose database/provider internals or submitted validation values.

## Tests

```bash
cd backend
../.venv/bin/python -m pytest -q
cd ..
npm run test:identity:client
npm run build
npm run test:identity:e2e    # OpenSSL + Playwright Chromium; isolated local test processes
```

The browser test generates a disposable TLS certificate, SQLite database, OIDC keys and fixture secret, then removes them. It runs the production build using the in-process provider double, not a real external service. `SENTRA_PYTHON` may point to another Python executable containing `requirements-test.txt`; `SENTRA_IDENTITY_BUILD` may point to a different Vite build directory. The `--ignore-certificate-errors` browser flag is used **only in this isolated self-signed test**. Python dependencies have bounded version ranges, not a locked production supply chain.

The two observed test warnings concern Starlette's TestClient/httpx transition and an intentionally weak RSA key used solely to prove weak-key rejection. See [the milestone handover](../docs/MILESTONE-1-HANDOVER.md) and [security/data map](../docs/MILESTONE-1-SECURITY-AND-DATA-MAP.md) for executed checks and the remaining acceptance gates.

## Remaining production boundaries

No real patient information should be used. Before any real-data pilot: independently assess the design; choose and test an identity provider and mailbox; implement protected shared PostgreSQL persistence and reviewed migrations, encryption and secrets management; build independent audit storage/retention and monitoring; provision and independently verify professional identities; add abuse/rate limiting, session/device management and provider revocation; harden TLS, browser security headers and proxy logs; establish backups, incident response, privacy/DPIA and clinical governance. The other module contracts in `app/contracts.py` remain sketches only: there is no FHIR server, clinical AI, live registry, routing engine, analytics service or telemedicine integration.
