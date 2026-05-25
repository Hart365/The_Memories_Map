# Workstream G Release R04

## Workstream
G - Privacy, Sharing, and Trust

## Status
In progress

## Scope completed this release
1. Fixed the historical Laravel migration blocker in the map guest email encryption migration.
2. Made the MySQL migration path robust when converting `map_guests.email` from `VARCHAR(255)` to `TEXT` for encrypted email storage.
3. Preserved foreign key support by adding a dedicated `map_id` index before removing the legacy composite unique index.
4. Verified the full migration path now completes successfully in Docker.

## Code changes
1. Hardened migration logic in:
- `backend/database/migrations/2026_05_25_001300_encrypt_map_guest_emails.php`

## Commenting and documentation
1. Added defensive migration helpers to detect column types and index existence safely across environments.
2. Recorded the migration repair in the workstream release log.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan migrate --force`
Result: migration `2026_05_25_001300_encrypt_map_guest_emails` completed successfully.
2. `docker compose exec app php /var/www/memories-map/backend/artisan migrate --force`
Result: second pass returned `Nothing to migrate`.
3. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass.
4. `docker compose exec db mysql -umemories_map_user -psecret -D memories_map -e "SHOW CREATE TABLE map_guests; SHOW INDEX FROM map_guests;"`
Result: confirmed the legacy composite email unique index was the blocker and validated the live schema shape before repair.

## WCAG 2.2 AAA evidence (Docker)
1. No frontend behavior changed in this backend migration repair.
2. Existing public-route WCAG baseline remains unaffected.

## Risks and follow-ups
1. Backend automated coverage is still minimal for map guest email hashing and encrypted lookup behavior.
2. A follow-up feature test should assert duplicate invite prevention now relies on `map_id + email_hash` rather than plaintext email.

## Sign-off
Pending
