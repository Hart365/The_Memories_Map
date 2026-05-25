# Workstream Release Index

## Current Progress Snapshot
Date: 2026-05-25

1. WS-A: In progress (`R01`)
2. WS-B: In progress (`R01`)
3. WS-C: In progress (`R02`)
4. WS-D: In progress (`R01`)
5. WS-E: In progress (`R01`)
6. WS-F: In progress (`R00`)
7. WS-G: In progress (`R05`)
8. WS-H: In progress (`R00`)

## Release Files
1. `2026-05-25_WS-A_backend-media-pipeline_R00.md`
2. `2026-05-25_WS-B_api-quality-contracts_R00.md`
3. `2026-05-25_WS-C_frontend-performance-robustness_R00.md`
4. `2026-05-25_WS-D_accessibility-interaction_R00.md`
5. `2026-05-25_WS-E_search-organization-navigation_R00.md`
6. `2026-05-25_WS-F_engagement-features_R00.md`
7. `2026-05-25_WS-G_privacy-sharing-trust_R00.md`
8. `2026-05-25_WS-H_observability-qa-operations_R00.md`
9. `2026-05-25_WS-G_privacy-sharing-trust_R01_media-at-rest-encryption.md`
10. `2026-05-25_WS-G_privacy-sharing-trust_R02_map-cascade-and-scoped-storage.md`
11. `2026-05-25_WS-G_privacy-sharing-trust_R03_legacy-storage-normalization.md`
12. `2026-05-25_WS-G_privacy-sharing-trust_R04_map-guest-email-migration-fix.md`
13. `2026-05-25_WS-G_privacy-sharing-trust_R05_backend-regression-tests-and-schema-guardrails.md`
14. `2026-05-25_WS-A_backend-media-pipeline_R01_queue-driven-processing-and-ops-controls.md`
15. `2026-05-25_WS-B_api-quality-contracts_R01_cursor-pagination-indexing-and-metrics.md`
16. `2026-05-25_WS-C_frontend-performance-robustness_R01_progressive-media-loading-and-budget.md`
17. `2026-05-25_WS-C_frontend-performance-robustness_R02_list-virtualization-and-windowed-media-grid.md`
18. `2026-05-25_WS-D_accessibility-interaction_R01_skip-link-focusability-and-keyboard-smoke.md`
19. `2026-05-25_WS-E_search-organization-navigation_R01_server-search-command-palette-version-display.md`

## Baseline Test Summary (Docker)
1. Backend tests: pass (`artisan test`, 2 tests)
2. Frontend build: pass (`npm run build`)
3. Frontend lint: pass (`npx eslint src --ext ts,tsx --max-warnings 0`)
4. WCAG checks: pass on public routes (`npm run a11y:test` with Docker browser path)

## Outstanding Validation
1. Authenticated WCAG routes pending credentials (`A11Y_TEST_EMAIL`, `A11Y_TEST_PASSWORD`).
2. Backend test depth is baseline-only and must be expanded in R01+ milestones.
