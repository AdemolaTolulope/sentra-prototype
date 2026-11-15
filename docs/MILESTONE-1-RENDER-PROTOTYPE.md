# Putting the senTRA synthetic prototype on Render

**What is done:** the project now has a `Dockerfile`, `.dockerignore`, `render.yaml`, and a single-origin FastAPI entry point that serves the compiled frontend and `/api` together. The equivalent single-origin application has been built and tested locally and can be viewed in the Arena preview.

**What is not done:** no Render service, Git repository, Firebase project, Auth0 tenant or mailbox has been created or connected. The Docker image and actual Render deployment have **not** been built or tested here because Docker and a Render connector are unavailable. A real Render build may still reveal platform-specific issues.

The prototype accepts **synthetic data only**. Do not publish or enter real patient or professional information. Existing modules and map sources remain demonstrations, and some imagery has non-commercial terms.

## The shortest path to a public demo

The prepared blueprint uses one **free Render web service**. It deliberately starts with **sign-in, registration and recovery disabled** because no external identity provider is configured. This makes the existing map and workspace prototype viewable; it does not complete identity acceptance.

1. Download the supplied `senTRA-milestone1-render-prototype-source.zip` and extract it. Use the inner `sentra` folder: `render.yaml` and `Dockerfile` should be at that folder's top level. The archive does **not** include the local SQLite database, `.env` files, credentials, dependency folders or generated `dist`.
2. Put the extracted project's **contents** in a new **private** Git repository. Do not overwrite the unrelated TerraShield project. One graphical option is to create a new repository using GitHub Desktop, copy the contents of `sentra` into the new local repository (including `.gitignore` and `.dockerignore`), commit the changes and choose **Publish repository → Keep this code private** [1](https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop). A Git provider account and authorization are required; Arena cannot do this account step through the available connectors.
3. In your own [Render Dashboard](https://dashboard.render.com/), choose **New → Blueprint**. Connect the new repository, select its branch, review the proposed **free** service and click **Deploy Blueprint** [1](https://render.com/docs/infrastructure-as-code). Render reads the root `render.yaml`, builds the Dockerfile, and provides an `onrender.com` HTTPS URL if deployment succeeds. Check any pricing, plan limits and terms before confirming.
4. When Render reports the deploy is live, open the provided URL. Visit `/#/account`: the account screen should say the provider is **not configured** and sign-in should be disabled. Visiting `/api/identity/status` should report `synthetic-local`, `unconfigured` and no real-health-data support. A configured provider status is **not** proof the provider was tested. If the build fails, share only a sanitized error—never environment values, tokens or callback URLs containing codes/state.

### Important free-plan limitation

Render documents that a free web service can spin down after 15 minutes of inactivity and that local files—including SQLite databases—are lost on spin-down, restart or redeploy. The first subsequent request can take roughly a minute to wake it [2](https://render.com/docs/free). Therefore **synthetic accounts, profiles, sessions, consent examples and audit records in this configuration can disappear**. This is not durable storage and must never hold real data. Durable storage would require additional design, configuration and potentially paid services; do not enable a paid option without the account owner's approval.

## Login: Auth0 and Firebase are separate choices

- **Auth0:** The already-built backend supports a compatible OIDC/PKCE provider. Auth0 was selected as the first managed test target, but no tenant is connected. The [Auth0 checklist](MILESTONE-1-AUTH0-TEST-CHECKLIST.md) explains the server-side setup and mailbox tests. The verified-email gate must be explicitly enabled for that test. The first-login professional-role return issue remains an acceptance gate.
- **Firebase:** Firebase Authentication could be used instead, but it is **not already integrated**. Firebase's documented backend integration verifies Firebase-issued ID tokens [1](https://firebase.google.com/docs/auth/admin/verify-id-tokens); it is not simply an Auth0 hostname replacement in this application's current OIDC/PKCE adapter. A Firebase-specific integration, project setup, security review and tests would be needed. Firebase hosting and Render hosting are alternatives for deployment, while Firebase Authentication can also be paired with a Render-hosted app.

Neither option is ready for real users or real health data. The user must choose and authorize any external provider/project; never paste passwords, client secrets, service-account keys, mailbox links, tokens or authorization codes into chat or a repository.

## Checks completed locally

- Production frontend build and TypeScript typecheck; identity-client tests.
- 36 backend synthetic tests, including new static-mount/API precedence and source-isolation tests.
- Single-origin smoke test: status/no-store, disabled login, unavailable test fixtures, no source files served, service worker and 320/390/768/1440 layouts.
- Desktop/mobile platform browser tests and identity browser/API tests using a test-only in-process provider; no actual Render, Auth0, Firebase or mailbox was contacted.
- Existing GEOACCESS, REFLEX, platform, MAMA-GUARD and data unit checks passed; 226 archived map/module/data files matched the previous satellite source archive byte-for byte.

Milestone 1 remains awaiting external integration, safe professional-role continuation, security/privacy review and user acceptance. Do not start Milestone 2 until the agreed gates are met.
