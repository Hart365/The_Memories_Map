# Workstream G Release R02

## Workstream
G - Privacy, Sharing, and Trust

## Status
In progress

## Scope completed this release
1. Enforced cascading media cleanup when deleting a memories map.
2. Added per-map UUID storage partitioning for newly uploaded encrypted media and thumbnails.
3. Added persistent map UUID (`map_uid`) with migration backfill for existing maps.
4. Clarified duplicate-detection scoping to the current map in media ingest flow.

## Code changes
1. `backend/app/Models/MemoriesMap.php`
- Added `map_uid` model field generation.
- Added model-level deleting hook to delete associated media through `MediaProcessingService`.
2. `backend/database/migrations/2026_05_25_140000_add_map_uid_to_memories_maps_table.php`
- Added `map_uid` unique column and backfilled existing rows.
3. `backend/app/Services/MediaProcessingService.php`
- New uploads now stored under `<map_uid>/...` subfolders.
- Thumbnail generation now writes under `<map_uid>/thumbnails/...`.
- Path resolution keeps backward compatibility with legacy flat files.
4. `backend/app/Http/Controllers/Api/MediaController.php`
- Added explicit comment documenting duplicate detection scope as map-local.
5. `README.md`
- Documented map-scoped storage and map-delete cascade behavior.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan migrate --path=database/migrations/2026_05_25_140000_add_map_uid_to_memories_maps_table.php --force`
Result: pass.
2. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass.
3. End-to-end integration script:
- Create map
- Ingest uploaded image
- Verify stored path starts with `map_uid/`
- Delete map
- Verify media soft-deleted and file + thumbnail removed from disk
Result: pass.

## WCAG 2.2 AAA evidence (Docker)
1. Existing baseline checks remain green from prior run:
- `npm run a11y:test` passed public-route pa11y + axe checks.

## Risks and follow-ups
1. Old files remain in legacy flat path until touched/deleted; this is intentional for backward compatibility.
2. Consider queued background relocation command for legacy file path normalization into `map_uid` folders.

## Sign-off
Pending
