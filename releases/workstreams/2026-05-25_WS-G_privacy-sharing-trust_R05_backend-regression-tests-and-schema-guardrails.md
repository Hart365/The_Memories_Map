# Workstream G Release R05

## Workstream
G - Privacy, Sharing, and Trust

## Status
In progress

## Scope completed this release
1. Added a proper Laravel backend test harness for feature tests.
2. Added regression tests for map guest email hashing and per-map uniqueness behavior.
3. Added schema guardrail test coverage for the MySQL-safe `map_guests` encrypted-email migration outcome.
4. Added media privacy/storage regression tests for tokenized decrypt-on-serve, map-scoped duplicate detection, legacy-path normalization, and map-delete media cascade behavior.
5. Ran full backend tests in Docker and confirmed all tests pass.

## Code changes
1. Added Laravel base test case:
- `backend/tests/TestCase.php`
2. Added guest invitation/login hashing tests:
- `backend/tests/Feature/GuestInvitationFeatureTest.php`
3. Added schema guardrail test for `map_guests` migration result:
- `backend/tests/Feature/MapGuestSchemaFeatureTest.php`
4. Added media privacy/storage regression tests:
- `backend/tests/Feature/MediaPrivacyFeatureTest.php`

## Commenting and documentation
1. Test methods are named to reflect production regressions they guard.
2. Assertions explicitly verify encrypted-at-rest behavior, map scoping, and migration-safe schema shape.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan test tests/Feature/GuestInvitationFeatureTest.php tests/Feature/MapGuestSchemaFeatureTest.php tests/Feature/MediaPrivacyFeatureTest.php`
Result: pass (`7 passed`, `45 assertions`).
2. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass (`9 passed`, `47 assertions`).

## WCAG 2.2 AAA evidence (Docker)
1. This release is backend test coverage only and does not alter frontend UI.
2. Existing WCAG baseline remains unchanged.

## Risks and follow-ups
1. Feature tests currently rely on the shared Docker database plus transactions; introducing a dedicated test database would further isolate CI.
2. Additional integration tests for guest middleware shared-route access (`guest.access`) can be added next.

## Sign-off
Pending
