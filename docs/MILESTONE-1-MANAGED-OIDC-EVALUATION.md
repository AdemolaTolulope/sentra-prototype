# Milestone 1 — managed OIDC test-provider options

**Decision so far:** the user selected **Auth0 as the first managed-provider test**. This does not replace the provider-neutral architecture or the later local/self-hosted options. No Auth0 tenant, database host or email service is configured or connected. No real patient or professional identities may be used.

## Recommendation before vendor selection

**Auth0 was recommended and selected as the first candidate** for a disposable managed test tenant. Its published OIDC discovery example advertises `S256`, `RS256` and `client_secret_basic`, which match the current adapter's requirements [1](https://dev.auth0.com/docs/get-started/applications/configure-applications-with-oidc-discovery). Its Universal Login supports a signup screen hint and provider-hosted password reset [1](https://auth0.com/docs/authenticate/login/auth0-universal-login/universal-login-vs-classic-login/universal-experience). This is a documentation-based recommendation, **not a successful integration test**. Check current pricing, tenant-region/data-residency options, terms and organizational requirements before choosing it.

**Amazon Cognito is a reasonable alternative** if the project already has an appropriate AWS account and operations support. AWS documents authorization-code/PKCE and RS256 user-pool tokens [1](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html). However, AWS community reports describe some Cognito discovery documents omitting `code_challenge_methods_supported` [1](https://repost.aws/questions/QUWgnfYNLDS6WIHsXxEDyFdg/missing-code-challenge-methods-supported-field-in-amazon-cognito-openid-connect-configuration). The current adapter **requires** discovery to advertise `S256`, so such a tenant would fail closed until a reviewed, tested compatibility approach is implemented. Cognito also commonly uses separate issuer/JWKS and hosted-login hosts, which must be explicitly allowlisted. These points have not been tested against a real Cognito tenant.

A different managed OIDC provider remains possible if it supports the adapter's current HTTPS, S256, RS256, bounded identity-encoded JSON and endpoint-host requirements. Each actual provider needs its own interoperability and security tests; supporting a common interface is not proof of compatibility.

## Dependencies for either option

1. A **disposable tenant and test-only identities**, not existing real patient or professional accounts. The app's `synthetic` label cannot verify that an external identity is fictional.
2. A stable HTTPS staging origin under the operator's control and the exact registered callback `https://<staging-host>/api/identity/callback`. The temporary Arena preview hostname/access layer may not be suitable or stable enough for a provider callback; verify reachability rather than assuming it.
3. A provider application/client configured for authorization code, S256 PKCE, RS256 and the `openid` scope (plus `email` if the strict verified-email gate is enabled); server-side secret management for the client secret (if used) and a separate stable, high-entropy subject-HMAC key. **Do not put secrets in chat, source code or frontend environment variables.** Rotating the HMAC key currently breaks account mapping and needs a migration plan.
4. Provider-supported registration and recovery configuration plus a disposable mailbox or mail-catching setup. Auth0's built-in email provider is intended for testing and has documented limitations; a suitable configured email provider is needed for production [1](https://auth0.com/docs/customize/email/smtp-email-providers). No email service is currently connected.
5. Explicit review of costs, contracts, available hosting regions, data processing, security, Nigerian legal obligations and applicable data-protection impact assessment before any real-data use.

## Known integration gaps to resolve during the real test

- No actual managed tenant has been contacted. The present browser test uses an in-process OIDC double, not Auth0 or Cognito.
- The optional `SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED=true` policy requests `openid email` and requires the signed `email_verified` claim to be exactly true before a session is issued. This gate has been tested with synthetic signed tokens only; the provider's actual verification and mailbox delivery have not been tested. The email address is processed transiently and not stored. The option defaults to false; explicitly enable it for the planned Auth0 test.
- The optional `SENTRA_OIDC_RECOVERY_VIA_LOGIN=true` path starts a normal, state-bound PKCE authorization flow with `prompt=login`; the user must then select the provider's own recovery option. It does not reset a password or send mail. This entry path has only been tested with a protocol double; Auth0 Universal Login, password-reset delivery and return behavior still need a real tenant and mailbox test. Do not invent a direct reset URL.
- The generic `/api/identity/login` return and recovery entry default to patient for a subject with no local profile. A failed unverified professional signup does not preserve the professional intent across an external verification link; a generic return can create a patient profile. This is demonstrated with the protocol double, not Auth0. A safe continuation design and real-provider test are acceptance gates; see the Auth0 checklist for a test-only workaround.
- Local app logout does not end the managed provider's session or immediately reflect provider-side revocation. Session/revocation design and reauthentication remain outstanding.
- A provider configuration does not establish professional verification, a secure shared database, independently protected audit or permission to process real health data.

## Proposed synthetic acceptance test

With an operator-provisioned disposable tenant and mailbox, first verify the discovery document and endpoint allowlist, then exercise registration, email verification, sign-in, profile ownership, session rotation/expiry, logout, password recovery and the provider's recovery-abuse protections. Verify rejection before email verification, if that is a required policy; test bad state/nonce, replay and direct cross-account access. Record actual provider/version/configuration, observable mailbox delivery and failures. Until those checks pass, the milestone remains **not fully accepted**.

No credentials or external resources have been created by this evaluation.
