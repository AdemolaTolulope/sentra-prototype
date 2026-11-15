# Build, data and test scripts

These scripts support the synthetic prototype. Prefer the named commands in the root `package.json` rather than invoking browser scripts without their documented setup.

- `test-*.mjs` and `validate-data.mjs` check synthetic data, client behaviour and calculations.
- `*-e2e.mjs`, `*-offline.mjs` and `smoke-test.mjs` use Playwright for browser checks; some need a running app or a production build.
- `identity-e2e.mjs` uses an isolated test-only OIDC double; it does not verify a real identity provider or mailbox.
- `test-render-prototype.mjs` checks an unconfigured synthetic single-origin app. Set `SENTRA_URL` to its base URL; this is not proof of a Render deployment.
- `prepare-*.py` generate derived geographic data; review provenance, licences and dependencies before regenerating assets.
- `service-worker-template.js` is the frontend service-worker source; API requests are excluded from its cache.

See the [technical reference](../docs/PROJECT-REFERENCE.md) and [backend guide](../backend/README.md) for prerequisites and test commands. Never add real health information or secrets to fixtures or screenshots.
