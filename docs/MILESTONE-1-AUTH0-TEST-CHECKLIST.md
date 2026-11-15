# Auth0 setup and test checklist — Milestone 1

**Status:** This is preparation guidance. No Auth0 tenant, test mailbox, HTTPS staging host or real-provider integration has been created or tested here. The current Arena preview has no provider and cannot sign users in. Use a **disposable test tenant, fictional account profiles and controlled test mailboxes only**. Never enter real patient, clinician or health information into this prototype.

Milestone 1 is not fully accepted; Milestone 2 remains on hold. The app's synthetic SQLite store and audit are not suitable for real or shared healthcare data. The provider-neutral design remains; Auth0 is simply the first managed test target. A [single-origin Render prototype](MILESTONE-1-RENDER-PROTOTYPE.md) is prepared but not deployed; its free-plan SQLite data is ephemeral and will not demonstrate durable accounts.

## Before you begin

You need:

- Authority to create a **separate Auth0 test tenant**, after reviewing available region, terms and any costs.
- A stable **HTTPS staging origin** that your test browser can reach, with the frontend and `/api` on the same origin, and outbound HTTPS from the backend to Auth0. The temporary Arena preview hostname or its access layer may not be suitable or stable enough; do not assume it will work.
- A functioning **test mailbox** you control, preferably with two distinct test addresses or supported aliases. These are real delivery addresses used for fictional test accounts. Do not use `example.invalid` or another undeliverable address to test email delivery.
- A backend secret manager or equivalent protected server-side configuration for the Auth0 client secret and a **separate**, random subject-HMAC key. **Never put secrets, passwords, email verification links, reset links, tokens or authorization codes in chat, source control, frontend environment variables, screenshots or logs.**

Auth0 normally redirects the user's browser to the callback rather than making a server-to-server call to it; the test browser must be able to reach the staging origin after leaving Auth0. A restrictive access layer must permit that same browser to return [1](https://auth0.com/docs/get-started/applications/work-with-auth0-locally). The backend still needs outbound access to Auth0 discovery, token and signing-key endpoints.

## 1. Prepare an HTTPS staging origin

If you already have a managed staging platform, configure it to serve the built frontend and forward `/api/*` **without stripping `/api`** to the synthetic backend. The origin, including scheme and host, must be the same for both. Do not rely on a browser-facing `localhost` address for a separate backend.

**Example only: a single disposable Linux host with Caddy.** This example is not deployed or verified here, and is not a production deployment recipe.

1. Obtain a test hostname under a domain you control and point its DNS to the test host. For Caddy's usual public-certificate flow, configure DNS and the necessary 80/443 network access; follow Caddy's HTTPS requirements [1](https://caddyserver.com/docs/automatic-https).
2. Transfer the **current project source** to the host, for example to `/srv/sentra`. Do not transfer the workspace's `.synthetic-data`, SQLite files, environment files, secrets, `.venv`, `node_modules`, caches or generated builds. Run the following on the test host with Node 22+ and Python 3.11+:

   ```bash
   cd /srv/sentra
   npm ci
   npm run build
   python3 -m venv .venv
   .venv/bin/python -m pip install -r backend/requirements-identity.txt
   ```

3. Run the backend as a dedicated, non-privileged test user. Put the isolated unencrypted database **outside** the frontend's served directory. Initially, without OIDC settings, an illustrative local start is:

   ```bash
   # Run as the dedicated test user, from /srv/sentra.
   install -d -m 700 "$HOME/.sentra-test"
   export SENTRA_IDENTITY_MODE=synthetic
   export SENTRA_SYNTHETIC_DB="$HOME/.sentra-test/identity.sqlite3"
   cd backend
   ../.venv/bin/python -m uvicorn app.main:app \
     --host 127.0.0.1 --port 8019 --no-access-log
   ```

   Use a suitable service manager and protected environment injection for an enduring test. Do not use the test-only browser harness. Only the reverse proxy should reach the loopback backend.
4. Install/configure Caddy using your host's instructions. Replace **both** the hostname and filesystem path below with your real values. Its Caddyfile routing follows Caddy's documented SPA/API pattern [2](https://caddyserver.com/docs/caddyfile/patterns):

   ```caddyfile
   stage.your-domain.tld {
       handle /api/* {
           reverse_proxy 127.0.0.1:8019
       }
       handle {
           root * /srv/sentra/dist
           try_files {path} /index.html
           file_server
       }
   }
   ```

   Caddy must be able to read the built `dist` files. Validate the configuration with `caddy validate --config /etc/caddy/Caddyfile` if that is where you installed it, and reload Caddy according to your host's service instructions. This sample contains **no tester access restriction**: add an appropriate access gateway or trusted-tester IP restriction without blocking certificate issuance or the browser's callback. Disable or redact callback query strings in reverse-proxy, gateway and infrastructure logs; they can contain authorization codes and state.
5. Open `https://YOUR_STAGING_HOST/#/account` in the test browser and `https://YOUR_STAGING_HOST/api/identity/status` in a separate tab. Before the provider is configured, the latter should indicate `synthetic-local` storage and `provider: unconfigured`; sign-in should be disabled. Use the browser-visible HTTPS hostname, not the backend's loopback address. Do not paste full callback URLs, session cookies or logs into chat.

A local HTTPS test may be possible instead of a public host, but it requires a certificate trusted by the test browser and Auth0 acceptance of the chosen callback/login URIs. The app itself rejects HTTP callbacks. Provider and Application Login URI restrictions must be checked separately; this alternative has not been exercised with Auth0.

## 2. Create the disposable Auth0 application

Dashboard labels can change; use Auth0's documentation if your tenant differs.

1. Sign in to the [Auth0 Dashboard](https://manage.auth0.com/) yourself. From the tenant menu choose **Create Tenant**, give it a test-only name and select the region after reviewing residency and costs [1](https://auth0.com/docs/get-started/auth0-overview/create-tenants/create-multiple-tenants). If available, set its environment tag to **Development** or **Staging** in tenant settings [2](https://auth0.com/docs/get-started/auth0-overview/create-tenants/set-up-multiple-environments).
2. Open **Applications → Applications → Create Application**. Select **Regular Web Application**; the confidential client runs on the backend, not in React. In the application's **Settings**, enter this exact **Allowed Callback URL**, replacing the placeholder with your actual origin:

   ```text
   https://YOUR_STAGING_HOST/api/identity/callback
   ```

   Do not add a trailing slash, wildcard, query or `/#/account`. The exact value must also be set in `SENTRA_OIDC_REDIRECT_URI`.
3. In **Advanced Settings → Grant Types**, ensure the **Authorization Code** grant is enabled; under **OAuth**, set the ID-token signing algorithm to **RS256**. In the **Credentials** tab, set the authentication method to **Client Secret Basic** for this backend [1](https://auth0.com/docs/get-started/applications/confidential-and-public-applications). Store the client secret in the backend secret manager, never in the frontend or chat.
4. Open `https://YOUR_AUTH0_DOMAIN/.well-known/openid-configuration` in a browser. Copy the exact `issuer` value, including its trailing slash if present; note the `authorization_endpoint`. Check that the actual tenant metadata supports S256, RS256 and `client_secret_basic`. Auth0 publishes a discovery example [2](https://auth0.com/docs/get-started/applications/configure-applications-with-oidc-discovery); the actual tenant remains untested.
5. Go to **Authentication → Database → Create DB Connection**, make a test-only connection, and enable your application on its **Applications** tab [1](https://auth0.com/docs/get-started/applications/set-up-database-connections). Allow email/password signup for the test and disable unrelated social or enterprise connections **for this test application**. Auth0 says it sends verification links to database users on signup by default; check the connection/template settings and actual delivery rather than assuming it [1](https://auth0.com/docs/manage-users/user-accounts/verify-emails).
6. For the provider's post-verification and password-reset return, an **Application Login URI** is required for the relevant Universal Login return behavior. A candidate for this prototype is:

   ```text
   https://YOUR_STAGING_HOST/api/identity/login
   ```

   Auth0 describes this as an application route that initiates authorization [2](https://auth0.com/docs/authenticate/login/auth0-universal-login/configure-default-login-routes). The route exists and starts a state-bound PKCE flow in the **local protocol-double test**, but has not been validated with Auth0. **Read the professional-profile warning in section 5 before using this return link.** The route does not preserve earlier registration intent and should not be treated as a general-purpose implementation of every Auth0 invitation/organization flow.

## 3. Prepare the test mailbox

- Use two different, controlled delivery addresses for the fictional patient and professional tests. If using plus-addresses, verify your mailbox accepts them and Auth0 treats them as distinct users. Keep the verification and reset links private.
- Auth0's built-in email sender requires no setup for limited tests. Auth0 documents a 10-emails-per-minute limit, a fixed sender, no custom templates, and no production support [1](https://auth0.com/docs/customize/email/smtp-email-providers). Check spam and tenant email logs if delivery fails. An external SMTP or mail-catching service is an alternative, but its account, sender and credentials must be configured separately.
- The senTRA backend **does not send email**. A configured Auth0 sender is not evidence of delivery; record the actual verification and reset messages received. Email verification is not identity proof or professional verification.

## 4. Configure the synthetic backend securely

Set the following on the **backend service only** and restart it. Placeholders below describe values; they are not usable configuration. The full reference is [backend/README.md](../backend/README.md).

| Setting | Value for this disposable test |
|---|---|
| `SENTRA_IDENTITY_MODE` | `synthetic` |
| `SENTRA_SYNTHETIC_DB` | Absolute path to the isolated local SQLite file, outside the web root |
| `SENTRA_OIDC_ISSUER` | Exact `issuer` string from your tenant's discovery document |
| `SENTRA_OIDC_CLIENT_ID` | The Auth0 test application's client ID |
| `SENTRA_OIDC_REDIRECT_URI` | The exact HTTPS callback registered above |
| `SENTRA_OIDC_TOKEN_AUTH_METHOD` | `client_secret_basic` |
| `SENTRA_OIDC_CLIENT_SECRET` | Auth0 client secret, supplied privately via server-side secret management |
| `SENTRA_SUBJECT_HMAC_KEY` | A **separate**, stable high-entropy secret with at least 32 UTF-8 bytes; generate it securely and retain it for this disposable dataset. Rotation changes account mappings; no migration exists. |
| `SENTRA_OIDC_SIGNUP_URL` | Your discovered Auth0 authorization endpoint with `?screen_hint=signup` appended, for example `https://YOUR_AUTH0_DOMAIN/authorize?screen_hint=signup`. This is a provider-specific configuration, not an independently tested integration. |
| `SENTRA_OIDC_REQUIRE_EMAIL_VERIFIED` | Set `true` for this test. **The current general default is `false`.** When enabled, senTRA requests `openid email` and requires the signed `email_verified` claim to be exactly boolean `true`. The address is processed transiently and not stored by the app. |
| `SENTRA_OIDC_RECOVERY_VIA_LOGIN` | Set `true` to expose the test recovery entry. It starts a PKCE login with `prompt=login`; the user must choose Auth0's password-reset option. Do not also set `SENTRA_OIDC_RECOVERY_URL`. |

The issuer host is already trusted for provider endpoints. Only add specific additional trusted hosts using `SENTRA_OIDC_ENDPOINT_HOSTS` if the tenant actually requires them. The adapter requires HTTPS and advertised S256, accepts RS256, limits provider JSON to 256,000 bytes and rejects compressed provider responses; actual Auth0 compatibility remains untested.

After restart, `/api/identity/status` should show `provider: configured-not-verified`, `registration_configured: true`, `recovery_configured: true` and `email_verification_required: true`. **Configured is not verified.** `email_delivery_connected_by_app: false` is expected because Auth0, not senTRA, sends mail. Stop if the app or proxy logs disclose credentials, codes, state, links or email addresses.

## 5. Test in a controlled sequence

Use private browser contexts and distinct test addresses so Auth0's existing SSO session does not silently reuse the other test identity. Keep each actual authorization flow in the **same** browser context, so its secure state cookie survives the redirect. If Auth0 skips signup because a session exists, start a fresh private browser context.

1. **Synthetic patient:** From `/#/account`, choose **Create an account** and register the fictional patient using the controlled address. Before clicking the verification email, record whether Auth0 returns a token with an unverified claim or blocks at the provider. With the backend gate enabled, no local senTRA session should be issued for an ID token whose signed claim is absent, false or non-boolean. If the provider blocks earlier, record that separately: it does not by itself demonstrate that the backend rejected an unverified token.
2. Open the actual verification email, complete verification and then sign in as the patient. Confirm the page shows a synthetic patient profile. Record message delivery and what happened; do not assume that a provider setting or a green status proves either.
3. **Synthetic professional — important workaround:** Use a fresh private context and a different fictional test account. Choose **Professional registration**, complete the provider signup and check the pre-verification behavior. After verifying the email, **do not click Auth0's generic “back to app” login link for the first successful senTRA login**. Instead, manually open `https://YOUR_STAGING_HOST/#/account` in that same test context and choose **Professional sign in**. Confirm the profile is `professional` and `unverified`.

   **Why:** the candidate `/api/identity/login` and the recovery entry default to `patient`. A failed unverified professional signup does not create a local profile or preserve the chosen type across the external email link. If the next successful login is the generic route, it creates a patient profile; choosing professional later does not change the stored role. This was reproduced with the in-process OIDC double, not Auth0. If the provider automatically takes the browser through the generic route, stop and record the result; use a fresh fictional test subject for a retry. A safe role-continuation design and real-provider test remain acceptance gates.
4. **Recovery:** On an already established test profile, choose **Recover account**, then Auth0's password-recovery option. Confirm an actual reset email arrives, complete the reset and test the return/login behavior. Record enumeration and rate-limit results without exposing real addresses. Recovery initiation is only provider-hosted login entry; senTRA does not send mail or reset passwords.
5. Test profile isolation, session expiry/rotation, CSRF, invalid state/nonce/signatures and replay, scoped synthetic grants and withdrawal, no-store responses, and logout. The app currently ends **only its own** session on logout. Password reset or provider revocation is not guaranteed to terminate an existing app session; test and record actual behavior. Professional verification remains unconnected.

Do not mark the milestone accepted if any step is blocked or differs from expectations. Record observed results and outstanding risks, then independently review shared persistence, audit protection, security/privacy and professional-verification controls.

## Troubleshooting and what to report

- **Callback mismatch:** compare the exact registered Auth0 callback and `SENTRA_OIDC_REDIRECT_URI`, including HTTPS, host and path.
- **503 or no redirect:** check protected backend configuration, outbound provider access, discovery metadata, trusted endpoint hosts and response encoding/size. `configured-not-verified` alone does not test connectivity.
- **Generic sign-in failure:** check email verification and provider settings privately; never paste an ID token or verification link into chat. Retry a new flow in the same browser context with cookies enabled and HTTPS working.
- **No mail:** check the controlled inbox/spam folder, Auth0 delivery logs, tenant settings and test-sender limits. Do not use a fictitious undeliverable domain.
- **Wrong profile type:** do not edit roles by hand. Record the generic-return issue and use a fresh fictional test subject for the test workaround; durable resolution is still required.

When ready, report only whether the **tenant**, **HTTPS origin** and **controlled mailbox** are ready, plus any sanitized error message. Sharing the non-secret staging origin or tenant domain is optional. **Do not share credentials, private email addresses, mailbox messages, links, tokens, codes or cookies.**
