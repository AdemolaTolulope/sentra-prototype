# Contributing to senTRA

Thank you for your interest in a student-led health-intelligence prototype. Thoughtful ideas, documentation feedback, accessibility improvements and reproducible bug reports are welcome through [GitHub Issues](https://github.com/AdemolaTolulope/sentra-prototype/issues).

## Before you start

1. Read the [project overview](README.md) and its demonstration-only limitations.
2. Open an issue to discuss substantial changes before investing time in them.
3. **Use fictional examples only.** Never submit real patient/professional information, contact details, access tokens, passwords or other secrets in code, issues, screenshots or pull requests.
4. Preserve the distinction between fictional healthcare examples and published geographic reference data. Keep source attribution and check each dataset's or imagery provider's licence.
5. Do not claim that a preview is a live clinical service, verified registry, diagnosis, real referral, professional verification or operational emergency system.

## Develop and check

Install Node.js 22 or newer, run `npm ci`, then `npm run dev`. Start with `npm run typecheck` and the relevant `npm run test:*` checks from the [technical reference](docs/PROJECT-REFERENCE.md). Backend-specific setup and tests are in [backend/README.md](backend/README.md). Browser tests may require a production build, Playwright Chromium and additional resources.

In a proposed change, explain what changed, list the checks actually run and disclose any tests not performed. Do not include provider credentials or real mailbox links. Report sensitive security concerns privately as described in [SECURITY.md](SECURITY.md).

## Permission and licensing

The repository is public, but no open-source license has yet been selected for the project. Contact the repository owner about permission for reuse or code contributions before submitting or redistributing code. Third-party data and imagery have their own licences and attribution requirements; public visibility does not replace those terms.
