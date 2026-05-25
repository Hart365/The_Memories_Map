# Workstream A Release R00

## Workstream
A - Backend Media Pipeline and Reliability

## Status
In progress

## Scope completed this release
1. Established Docker test baseline for ongoing backend reliability work.
2. Added backend test scaffolding so pipeline checks are executable.

## Code changes
1. Added `backend/tests/Unit/SanityTest.php`.
2. Added `backend/tests/Feature/SanityFeatureTest.php`.

## Commenting and documentation
1. Release process documented in `releases/workstreams/RELEASE_PROCESS.md`.
2. Implementation roadmap documented in `IMPLEMENTATION_WORK_PLAN.md`.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass (2 tests).
2. `docker compose exec frontend sh -lc "npm run build"`
Result: pass.

## WCAG 2.2 AAA evidence (Docker)
1. `docker compose exec frontend sh -lc "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser CHROME_PATH=/usr/bin/chromium-browser npm run a11y:test"`
Result: pa11y pass for public pages, axe pass for public pages.

## Risks and follow-ups
1. Authenticated WCAG checks require `A11Y_TEST_EMAIL` and `A11Y_TEST_PASSWORD`.
2. Replace sanity tests with real unit and feature coverage as stream work lands.

## Sign-off
Pending
