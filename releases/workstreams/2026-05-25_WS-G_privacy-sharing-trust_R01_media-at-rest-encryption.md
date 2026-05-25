# Workstream G Release R01

## Workstream
G - Privacy, Sharing, and Trust

## Status
In progress

## Scope completed this release
1. Added encryption at rest for newly uploaded media originals and thumbnails.
2. Added transparent decrypt-on-serve handling in authorized media endpoints.
3. Added one-time migration command to encrypt existing plaintext media files.
4. Documented encryption configuration and migration command.

## Code changes
1. Updated media storage service:
- `backend/app/Services/MediaProcessingService.php`
2. Updated media serving controller:
- `backend/app/Http/Controllers/Api/MediaController.php`
3. Added migration command:
- `backend/app/Console/Commands/EncryptExistingMedia.php`
4. Added config/env docs:
- `backend/config/filesystems.php`
- `backend/.env.example`
- `README.md`

## Commenting and documentation
1. Added concise comments in encryption flow for implementation intent.
2. Added README security notes for encryption configuration and migration command.

## Test evidence (Docker)
1. `docker compose exec app php /var/www/memories-map/backend/artisan test`
Result: pass.
2. `docker compose exec app php /var/www/memories-map/backend/artisan media:encrypt-existing --dry-run --limit=20`
Result: command runs and reports expected encryptable files.
3. `docker compose exec app php /var/www/memories-map/backend/artisan media:encrypt-existing`
Result: full migration complete (850 rows processed, no missing files).
4. Tokenized thumbnail endpoint smoke check against encrypted data
Result: HTTP 200 with non-zero image payload.

## WCAG 2.2 AAA evidence (Docker)
1. `docker compose exec frontend sh -lc "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser CHROME_PATH=/usr/bin/chromium-browser npm run a11y:test"`
Result: pa11y + axe pass for public pages.

## Risks and follow-ups
1. This is strong at-rest hardening, but a privileged host admin with full runtime access can still inspect process memory or app keys.
2. For zero-knowledge guarantees against host administrators, add client-side end-to-end encryption with user-held keys.
3. Large-file encryption/decryption uses in-process memory; Docker PHP memory limit was raised to 2048M for reliability in this environment.

## Sign-off
Pending
