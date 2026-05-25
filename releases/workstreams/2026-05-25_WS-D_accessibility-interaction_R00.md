# Workstream D Release R00

## Workstream
D - Accessibility and Interaction Quality

## Status
In progress

## Scope completed this release
1. Enabled container-safe WCAG automation execution.
2. Validated public-route WCAG 2.2 AAA checks in Docker.

## Code changes
1. Updated `frontend/scripts/run-axe.mjs` to support Docker/root execution with explicit browser path and no-sandbox flags.

## Commenting and documentation
1. Added inline code comment in `frontend/scripts/run-axe.mjs` explaining no-sandbox rationale in Docker.
2. Added release process and evidence docs in `releases/workstreams`.

## Test evidence (Docker)
1. `docker compose exec frontend sh -lc "npm run build"`
Result: pass.
2. `docker compose exec frontend sh -lc "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser CHROME_PATH=/usr/bin/chromium-browser npm run a11y:test"`
Result: pass for public routes.

## WCAG 2.2 AAA evidence (Docker)
1. pa11y checks pass for `/login`, `/register`, `/404`.
2. axe checks pass for `/login`, `/register`.
3. Authenticated checks currently skipped without test credentials.

## Risks and follow-ups
1. Provide `A11Y_TEST_EMAIL` and `A11Y_TEST_PASSWORD` for full authenticated-route coverage.
2. Add keyboard-flow automation in future release.

## Sign-off
Pending
