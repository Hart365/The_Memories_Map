# Workstream H Release R00

## Workstream
H - Observability, QA, and Operations

## Status
In progress

## Scope completed this release
1. Executed Docker-based baseline validation for backend tests, frontend quality, and WCAG checks.
2. Established release process requiring evidence for each workstream milestone.

## Code changes
1. Added baseline backend tests to make CI-style backend validation executable.
2. Added Docker-compatible accessibility automation updates.

## Commenting and documentation
1. `releases/workstreams/RELEASE_PROCESS.md` created.
2. Workstream release records created for A-H (R00).

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass.
2. `docker compose exec frontend sh -lc "npm run build"`
Result: pass.
3. `docker compose exec frontend sh -lc "npx eslint src --ext ts,tsx --max-warnings 0"`
Result: no lint output (pass).

## WCAG 2.2 AAA evidence (Docker)
1. `docker compose exec frontend sh -lc "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser CHROME_PATH=/usr/bin/chromium-browser npm run a11y:test"`
Result: pa11y and axe pass for public pages.

## Risks and follow-ups
1. Authenticated WCAG route coverage pending test account credentials.
2. Expand backend tests beyond baseline smoke checks.

## Sign-off
Pending
