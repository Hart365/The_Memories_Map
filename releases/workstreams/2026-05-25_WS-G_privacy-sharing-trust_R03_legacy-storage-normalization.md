# Workstream G Release R03

## Workstream
G - Privacy, Sharing, and Trust

## Status
In progress

## Scope completed this release
1. Added a normalization command to move legacy flat media paths into per-map UUID folders.
2. Ran the full normalization migration for all existing media rows.
3. Repaired runtime directory-permission handling so normalized per-map folders remain accessible to PHP-FPM.
4. Verified tokenized media serving still works after storage-path normalization.

## Code changes
1. Added normalization command:
- `backend/app/Console/Commands/NormalizeMediaStoragePaths.php`
2. Repaired and finalized map-scoped storage and directory access handling:
- `backend/app/Services/MediaProcessingService.php`
3. Updated README documentation already reflects per-map UUID folder storage.

## Commenting and documentation
1. Normalization workflow is now captured in release artifacts.
2. Media storage behavior remains documented in the security section of `README.md`.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan media:normalize-storage-paths --dry-run --limit=25`
Result: dry run succeeded with zero missing files.
2. `docker compose exec app php /var/www/memories-map/backend/artisan media:normalize-storage-paths`
Result: full migration completed for 850 rows, zero missing files.
3. Endpoint smoke test after normalization
Result: tokenized thumbnail endpoint returned HTTP 200 with non-zero payload.
4. Idempotency re-check
Result: subsequent dry run reports rows skipped as already scoped.
5. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass.

## WCAG 2.2 AAA evidence (Docker)
1. No frontend accessibility regressions were introduced by this backend-only storage normalization work.
2. Prior public-route pa11y and axe baseline remains valid.

## Risks and follow-ups
1. Full `artisan migrate` is still blocked by an unrelated historical migration involving `map_guests.email` text indexing.
2. For larger future migrations, a batched queued normalization command may still be preferable.

## Sign-off
Pending
