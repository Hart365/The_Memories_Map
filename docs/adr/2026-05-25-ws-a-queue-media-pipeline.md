# ADR: Queue-Driven Media Processing Pipeline (Workstream A)

## Status
Accepted (2026-05-25)

## Context
Media ingest previously performed EXIF parsing, video probing, thumbnail generation, and reverse geocoding inline during upload requests. This made upload latency sensitive to media size, metadata complexity, and external geocoding response time.

## Decision
1. Upload requests now persist media rows immediately with `processing_status=queued`.
2. A dedicated queue job (`ProcessMediaPipelineJob`) performs metadata extraction and thumbnail generation asynchronously.
3. Processing state is tracked per media item with:
   - `processing_status` (`queued`, `processing`, `completed`, `failed`)
   - `processing_stage`
   - `processing_attempts`
   - `processing_error`
   - `processing_started_at`, `processing_finished_at`
4. Retries and resilience are configured via:
   - `MEDIA_PROCESSING_TRIES`
   - `MEDIA_PROCESSING_TIMEOUT_SECONDS`
   - `MEDIA_PROCESSING_BACKOFF_SECONDS`
   - dedicated queue name `MEDIA_PROCESSING_QUEUE`
5. Operations visibility and replay controls are exposed through:
   - `GET /api/admin/queue/health`
   - `POST /api/admin/queue/replay-failed`
   - `php artisan queue:failed-replay`

## Consequences
1. Upload API response time is decoupled from heavy media post-processing.
2. Frontend can poll `GET /api/maps/{map}/media/{media}/processing-status` for progress.
3. Failures are explicit and recoverable through replay tools.
4. Local Docker requires a queue worker (`queue_worker`) for asynchronous completion.

## Validation
1. Database migration applied in Docker.
2. New queue pipeline feature tests pass.
3. Full backend test suite remains green.
