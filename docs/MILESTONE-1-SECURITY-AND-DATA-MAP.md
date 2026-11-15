# Milestone 1 — synthetic identity security and data map

**Status:** developer threat model for a synthetic-only prototype, not an independent penetration test, legal assessment or production-security sign-off. Do not use real patient or professional information. See [the milestone handover](MILESTONE-1-HANDOVER.md) for tests and unresolved acceptance gates.

## Trust boundaries

```text
Browser: existing React account page; in-memory CSRF token; HttpOnly session cookie
    │ same-origin /api over HTTPS when a provider is configured
    ▼
Vite development/preview proxy (or a future, separately secured reverse proxy)
    │ internal /api forwarding; proxy configuration is server-side
    ▼
FastAPI synthetic identity API ── HTTPS OIDC endpoints on configured allowlist
    │                               (NO PROVIDER CONNECTED BY DEFAULT)
    ▼
Local, unencrypted synthetic SQLite file: minimal accounts, sessions,
one-time login flows, fixed example resource IDs, grants and audit events

Production service worker: static shell and selected PUBLIC geographic files.
It explicitly does not intercept /api. Existing GEOACCESS/REFLEX/MAMA-GUARD
remain separate synthetic demonstrations, not protected patient-data clients.
```

The UI is a presentation layer, never the authorization boundary. The `synthetic` label does not prove that an operator-configured provider account is fictional; only disposable synthetic tenants and identities may be used. No real-data path, trusted shared database or independently protected audit store has been established. The test harness under `backend/tests/` contains an isolated OIDC double and a guarded synthetic-only verification fixture; it is not imported by the application and must never be deployed.

## Data inventory and lifetime

| Data | Where used/stored | Current boundary |
|---|---|---|
| Provider issuer and subject | Issuer plus keyed HMAC of `issuer + subject` in local SQLite. | Raw subject is not stored by this app; the result is pseudonymous, not anonymous. Key rotation/migration is not implemented. |
| Account/profile | Opaque account ID, synthetic classification, server-owned role, verification state, enum language and optional enum professional category. | No name, contact, password, clinical narrative or patient record is accepted. Professional status starts unverified. |
| App session | Random cookie value is `Secure`, `HttpOnly`, `SameSite=Lax` and `__Host-`; only its SHA-256 hash, account ID and times are stored server-side. | Fixed expiry (default eight hours), app-local logout and rotation on a later successful sign-in. Browser obtains a derived CSRF token in a no-store response and holds it in memory. |
| Login flow | Hashes of state and browser secret; nonce, PKCE verifier, intent and expiry in SQLite. | Single use and browser-bound; the verifier is a temporary secret and SQLite is **not encrypted**. Expired rows are cleaned on a later flow start; deletion does not guarantee disk erasure. |
| Synthetic resources | Opaque resource ID, owner ID, classification and timestamp. | Content is a fixed server-supplied example, not user-submitted data. |
| Synthetic grants | Opaque owner, recipient and resource IDs; fixed scope/purpose, grant/expiry/withdrawal times. | Only for the fixed synthetic resource. No real report, referral, email or actual legal consent is represented. |
| Local audit | Timestamp, opaque actor/target IDs, fixed action/target codes and outcome. | Normal updates/deletes are blocked by SQLite triggers; no public viewer. A database owner can alter or remove it. No independent retention, export, alerting or immutable storage exists. |
| Browser preferences and module examples | Device display preferences in IndexedDB; REFLEX synthetic examples in localStorage; MAMA-GUARD examples in tab memory. | Pre-existing, separate demonstrations. They are not authenticated records, real consent or secure health-data stores. The account API does not store session or CSRF values in these browser stores. |

OAuth access/refresh and ID tokens are processed transiently by the server, not written to the application database. Do not enable unredacted reverse-proxy, application or provider logs: the authorization callback URL contains a one-time code and state. `--no-access-log` is used in local examples, but production log redaction and retention controls remain unimplemented. Provider-specific email verification/recovery is external; this app neither stores email addresses nor sends email.

## Threats, implemented controls and residual risk

| Threat | Current synthetic control | Important unresolved work |
|---|---|---|
| Role self-assignment | Only patient/professional first-login intents; provider role claims ignored; profile rejects role/verification fields; professionals remain unverified. | Authorized operations/admin provisioning and independent professional verification do not exist. |
| Cross-account resource access | Current server session and database-owned role rechecked in each protected transaction; ownership or matching verified-professional grant required; deny by default. | Not connected to the existing workspaces or real healthcare objects; additional policies and independent review are required. |
| Consent bypass or withdrawal race | Fixed recipient/resource/scope/purpose and expiry checked at read; SQLite serializes access checks, withdrawal and audit. | No real consent/legal-basis workflow, care relationship, off-platform copy recall or multi-service enforcement. |
| Login CSRF, code interception, replay and forged tokens | HTTPS OIDC endpoints, allowlisted hosts, code flow with S256 PKCE, one-time browser-bound state, nonce and RS256/claim verification. | No real provider interoperability test, external security review, provider revocation or multi-provider support. A provider outage prevents new login but existing local sessions are not remotely introspected. |
| Cross-site mutations and session theft | HttpOnly/Secure cookie, CSRF header tied to the server session, origin comparison when present, expiry and local revocation; no tokens in browser storage. | XSS, compromised browser/server or privileged local access can still defeat these controls. Browser security policy, short reauthentication, device controls and monitoring are not complete. |
| Audit removal or data-file access | Minimal fixed-code events, no audit HTTP endpoint, append-only SQL triggers, local file mode check. | SQLite has no encryption and its owner can tamper with data or audit. Independent audit, retention, monitoring, protected backups and access segregation are required. |
| Provider endpoint substitution / SSRF | Provider configuration is operator-supplied; HTTPS and exact host[:port] allowlist; no HTTP redirects on provider requests. | Trusted DNS, egress restrictions, secret management, dependency pinning and external review remain necessary. |
| Email verification / recovery abuse | Optional strict signed `email_verified=true` gate; optional recovery begins a state-bound provider login. No home-grown password reset or app email delivery. | The gate defaults off and must be explicitly enabled for the planned Auth0 test; a true provider claim is not proof that delivery was tested. Provider-hosted verification, mailbox delivery, enumeration resistance, rate limiting and abuse handling have not been tested here. |
| First-login role after external verification | The first successful sign-in creates a patient or unverified professional profile; a later login intent cannot change that stored role. | The generic `/api/identity/login` and recovery-entry flows default to patient and do not preserve a failed professional registration intent across an external verification link. A protocol-double test demonstrates the misclassification risk. A safe continuation design and real-provider test are needed before acceptance. |
| API caching / offline leakage | `no-store`/`no-cache` headers; explicit service-worker `/api` bypass; browser tests inspect storage and caches. | Browser extensions, proxies, OS caches, downloads and other applications are outside the test. No real data is permitted. |
| Local database compromise and data retention | Synthetic-only schema; new DB file mode 0600 and symlink/permission checks; secrets not included in config repr. | No at-rest encryption, full secure deletion, robust secrets rotation, shared deployment isolation or disaster recovery. |

## Release gate

The local synthetic checks do not establish production readiness or full Milestone 1 acceptance. A genuine disposable provider, registered HTTPS callback, test mailbox, provider-specific sign-in/registration/recovery and abuse tests, shared secure persistence and migrations, verified-professional governance, independent audit and security/privacy review remain outstanding. Do not start the next milestone until the user has reviewed the result and the agreed acceptance gates have been met.
