<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use App\Models\MemoriesMap;
use App\Models\User;
use App\Services\MediaProcessingService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Validation\Rules\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly MediaProcessingService $processor) {}

    public function index(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('view', $map);

        $validated = $request->validate([
            'date' => ['nullable', 'date'],
            'has_location' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:captured_at_asc,captured_at_desc,created_at_desc,size_desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'cursor' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:200'],
        ]);

        $query = $map->mediaFiles();

        if ($request->filled('date')) {
            $query->whereDate('captured_at', $request->date);
        }

        if ($request->filled('q')) {
            $term = '%' . addcslashes($validated['q'], '%_\\') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('user_caption', 'LIKE', $term)
                  ->orWhere('location_name', 'LIKE', $term)
                  ->orWhere('location_city', 'LIKE', $term)
                  ->orWhere('location_country', 'LIKE', $term)
                  ->orWhere('original_name', 'LIKE', $term)
                  ->orWhere('user_tags', 'LIKE', $term);
            });
        }

        if ($request->filled('has_location')) {
            $query->whereNotNull('latitude')->whereNotNull('longitude');
        }

        $sort = (string) ($validated['sort'] ?? 'captured_at_asc');

        if ($sort === 'captured_at_desc') {
            $query->orderByDesc('captured_at')->orderByDesc('id');
        } elseif ($sort === 'created_at_desc') {
            $query->orderByDesc('created_at')->orderByDesc('id');
        } elseif ($sort === 'size_desc') {
            $query->orderByDesc('size_bytes')->orderByDesc('id');
        } else {
            $query->orderBy('captured_at')->orderBy('id');
        }

        $perPage = (int) ($validated['per_page'] ?? 50);
        $page = $query->cursorPaginate($perPage, ['*'], 'cursor', $validated['cursor'] ?? null);

        $items = collect($page->items())
            ->map(function (MediaFile $media): MediaFile {
                if ($media->thumbnail_name && !$this->mediaThumbnailExists($media)) {
                    $media->thumbnail_name = null;
                }

                return $media;
            })
            ->values();

        return response()->json([
            'data' => $items,
            'meta' => [
                'per_page' => $page->perPage(),
                'next_cursor' => $page->nextCursor()?->encode(),
                'prev_cursor' => $page->previousCursor()?->encode(),
                'has_more' => $page->hasMorePages(),
            ],
        ]);
    }

    public function store(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $maxMb = (int) config('app.max_upload_size_mb', 500);

        $request->validate([
            'files'   => ['required', 'array'],
            'files.*' => [
                'required',
                File::types(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'mkv', 'm4v'])
                    ->max($maxMb * 1024),
            ],
            'duplicate_options' => ['nullable', 'array'],
            'duplicate_options.filename' => ['nullable', 'boolean'],
            'duplicate_options.size' => ['nullable', 'boolean'],
            'duplicate_options.capture_date' => ['nullable', 'boolean'],
            'duplicate_options.gps' => ['nullable', 'boolean'],
            'duplicate_options.camera_make' => ['nullable', 'boolean'],
            'duplicate_options.camera_model' => ['nullable', 'boolean'],
        ]);

        $created = [];
        $duplicates = [];
        $duplicateOptions = $this->normalizeDuplicateOptions($request->input('duplicate_options', []));

        // Get existing media only within this map for duplicate detection.
        $existingMedia = $map->mediaFiles()
            ->get(['id', 'original_name', 'size_bytes', 'captured_at', 'latitude', 'longitude', 'camera_make', 'camera_model'])
            ->keyBy('id');

        foreach ($request->file('files') as $upload) {
            $originalName = $upload->getClientOriginalName();
            
            // Check if this is a true duplicate
            $isDuplicate = $this->isDuplicate($upload, $existingMedia, $created, $duplicateOptions);
            
            if ($isDuplicate) {
                $duplicates[] = $originalName;
                continue;
            }

            $media = $this->processor->ingest($upload, $map);
            $created[] = $media;
        }

        return response()->json([
            'data' => $created,
            'duplicates' => $duplicates,
            'created_count' => count($created),
            'skipped_count' => count($duplicates),
        ], count($created) > 0 ? 201 : 200);
    }

    /**
     * Check if an uploaded file is a true duplicate based on multiple criteria.
     * A file is only considered a duplicate if it matches on multiple key attributes.
     */
    private function isDuplicate(UploadedFile $upload, $existingMedia, array $currentBatch, array $options): bool
    {
        $enabledCount = count(array_filter($options));
        if ($enabledCount === 0) {
            return false;
        }

        $filename = strtolower($upload->getClientOriginalName());
        $fileSize = $upload->getSize();
        
        // Extract EXIF data from upload to compare
        $needsExif = $options['capture_date'] || $options['gps'] || $options['camera_make'] || $options['camera_model'];
        $uploadExif = $needsExif ? $this->safeReadExifData($upload->getRealPath()) : null;
        $uploadCapturedAt = is_array($uploadExif)
            ? ($uploadExif['DateTimeOriginal'] ?? $uploadExif['DateTime'] ?? null)
            : null;
        $uploadLat = $options['gps'] ? $this->getGpsCoordinate($uploadExif, 'GPSLatitude', 'GPSLatitudeRef') : null;
        $uploadLon = $options['gps'] ? $this->getGpsCoordinate($uploadExif, 'GPSLongitude', 'GPSLongitudeRef') : null;
        $uploadCameraMake = is_array($uploadExif) ? ($uploadExif['Make'] ?? null) : null;
        $uploadCameraModel = is_array($uploadExif) ? ($uploadExif['Model'] ?? null) : null;

        $requiredMatches = $enabledCount <= 2
            ? $enabledCount
            : max(2, (int) ceil($enabledCount * 0.6));
        
        // Check against existing media in database
        foreach ($existingMedia as $existing) {
            $matchCount = 0;
            
            // Compare filename (case-insensitive)
            if ($options['filename'] && strtolower($existing->original_name) === $filename) {
                $matchCount++;
            }
            
            // Compare file size (exact match)
            if ($options['size'] && $existing->size_bytes === $fileSize) {
                $matchCount++;
            }
            
            // Compare capture date (if available)
            if ($options['capture_date'] && $uploadCapturedAt && $existing->captured_at) {
                $existingDate = $existing->captured_at->format('Y:m:d H:i:s');
                if ($uploadCapturedAt === $existingDate) {
                    $matchCount++;
                }
            }
            
            // Compare GPS coordinates (within 0.0001 degrees ~ 11 meters)
            if ($options['gps'] && $uploadLat !== null && $uploadLon !== null && $existing->latitude !== null && $existing->longitude !== null) {
                $latDiff = abs($uploadLat - $existing->latitude);
                $lonDiff = abs($uploadLon - $existing->longitude);
                if ($latDiff < 0.0001 && $lonDiff < 0.0001) {
                    $matchCount++;
                }
            }
            
            // Compare camera info
            if ($options['camera_make'] && $uploadCameraMake && $existing->camera_make && 
                strtolower($uploadCameraMake) === strtolower($existing->camera_make)) {
                $matchCount++;
            }
            if ($options['camera_model'] && $uploadCameraModel && $existing->camera_model && 
                strtolower($uploadCameraModel) === strtolower($existing->camera_model)) {
                $matchCount++;
            }
            
            if ($matchCount >= $requiredMatches) {
                return true;
            }
        }
        
        // Check against files in current batch
        foreach ($currentBatch as $batchMedia) {
            $batchMatchCount = 0;

            if ($options['filename'] && strtolower($batchMedia->original_name) === $filename) {
                $batchMatchCount++;
            }

            if ($options['size'] && $batchMedia->size_bytes === $fileSize) {
                $batchMatchCount++;
            }

            if ($options['capture_date'] && $uploadCapturedAt && $batchMedia->captured_at) {
                $batchDate = $this->normalizeDateValue($batchMedia->captured_at);
                if ($batchDate && $batchDate === $uploadCapturedAt) {
                    $batchMatchCount++;
                }
            }

            if ($options['gps'] && $uploadLat !== null && $uploadLon !== null && $batchMedia->latitude !== null && $batchMedia->longitude !== null) {
                $latDiff = abs($uploadLat - $batchMedia->latitude);
                $lonDiff = abs($uploadLon - $batchMedia->longitude);
                if ($latDiff < 0.0001 && $lonDiff < 0.0001) {
                    $batchMatchCount++;
                }
            }

            if ($options['camera_make'] && $uploadCameraMake && $batchMedia->camera_make &&
                strtolower($uploadCameraMake) === strtolower($batchMedia->camera_make)) {
                $batchMatchCount++;
            }

            if ($options['camera_model'] && $uploadCameraModel && $batchMedia->camera_model &&
                strtolower($uploadCameraModel) === strtolower($batchMedia->camera_model)) {
                $batchMatchCount++;
            }

            if ($batchMatchCount >= $requiredMatches) {
                return true;
            }
        }
        
        return false;
    }

    private function safeReadExifData(string $path): array|false
    {
        if (!function_exists('exif_read_data')) {
            return false;
        }

        return @exif_read_data($path);
    }

    private function normalizeDuplicateOptions(array $options): array
    {
        $defaults = [
            'filename' => true,
            'size' => true,
            'capture_date' => true,
            'gps' => true,
            'camera_make' => true,
            'camera_model' => true,
        ];

        foreach ($defaults as $key => $default) {
            if (array_key_exists($key, $options)) {
                $defaults[$key] = filter_var($options[$key], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                $defaults[$key] = $defaults[$key] ?? $default;
            }
        }

        return $defaults;
    }

    private function normalizeDateValue(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y:m:d H:i:s');
        }

        if ($value === null) {
            return null;
        }

        $timestamp = strtotime((string) $value);
        if ($timestamp === false) {
            return null;
        }

        return date('Y:m:d H:i:s', $timestamp);
    }
    
    /**
     * Extract GPS coordinate from EXIF data.
     */
    private function getGpsCoordinate($exif, string $key, string $refKey): ?float
    {
        if (!isset($exif[$key]) || !isset($exif[$refKey])) {
            return null;
        }
        
        $coordinate = $exif[$key];
        $ref = $exif[$refKey];
        
        if (!is_array($coordinate) || count($coordinate) < 3) {
            return null;
        }
        
        // Convert DMS to decimal
        $degrees = $this->evalFraction($coordinate[0]);
        $minutes = $this->evalFraction($coordinate[1]);
        $seconds = $this->evalFraction($coordinate[2]);
        
        $decimal = $degrees + ($minutes / 60) + ($seconds / 3600);
        
        if ($ref === 'S' || $ref === 'W') {
            $decimal *= -1;
        }
        
        return $decimal;
    }
    
    /**
     * Evaluate fraction strings from EXIF (e.g., "50/1")
     */
    private function evalFraction($value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }
        
        if (is_string($value) && str_contains($value, '/')) {
            [$numerator, $denominator] = explode('/', $value);
            if ($denominator != 0) {
                return (float) $numerator / (float) $denominator;
            }
        }
        
        return 0.0;
    }

    public function show(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('view', $map);
        $this->ensureBelongsToMap($media, $map);

        return response()->json($media->load('notes'));
    }

    public function processingStatus(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('view', $map);
        $this->ensureBelongsToMap($media, $map);

        $fresh = $media->fresh();

        return response()->json([
            'id' => $fresh?->id,
            'processing_status' => $fresh?->processing_status,
            'processing_stage' => $fresh?->processing_stage,
            'processing_attempts' => $fresh?->processing_attempts,
            'processing_error' => $fresh?->processing_error,
            'processing_started_at' => $fresh?->processing_started_at,
            'processing_finished_at' => $fresh?->processing_finished_at,
            'processed_at' => $fresh?->processed_at,
            'thumbnail_name' => $fresh?->thumbnail_name,
        ]);
    }

    public function update(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('update', $map);
        $this->ensureBelongsToMap($media, $map);

        $validated = $request->validate([
            'user_caption' => ['nullable', 'string', 'max:2000'],
            'user_tags'    => ['nullable', 'array'],
            'user_tags.*'  => ['string', 'max:100'],
            'captured_at'  => ['nullable', 'date'],
            'latitude'     => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'    => ['nullable', 'numeric', 'between:-180,180'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'location_address' => ['nullable', 'string', 'max:255'],
            'location_city' => ['nullable', 'string', 'max:255'],
            'location_country' => ['nullable', 'string', 'max:255'],
        ]);

        $media->update($validated);

        return response()->json($media->fresh());
    }

    /**
     * Rescan a single media file for location data.
     */
    public function rescanLocation(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('update', $map);
        $this->ensureBelongsToMap($media, $map);

        $updated = $this->processor->rescanForLocation($media);

        return response()->json([
            'updated' => $updated,
            'media' => $media->fresh(),
        ]);
    }

    /**
     * Rescan all media files in a map for location data.
     * Only processes files with GPS coordinates but missing enhanced location data.
     */
    public function rescanMapLocations(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        // Only scan media that has GPS but is missing enhanced location data
        $media = $map->mediaFiles->filter(function ($item) {
            return $item->latitude !== null 
                && $item->longitude !== null 
                && empty($item->location_name);
        });

        $updated = 0;
        $skipped = 0;

        foreach ($media as $item) {
            if ($this->processor->rescanForLocation($item)) {
                $updated++;
            } else {
                $skipped++;
            }
        }

        return response()->json([
            'total' => $media->count(),
            'updated' => $updated,
            'skipped' => $skipped,
        ]);
    }

    public function destroy(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('update', $map);
        $this->ensureBelongsToMap($media, $map);

        $this->processor->delete($media);

        return response()->json(null, 204);
    }

    /** Serve the raw media file (owner only). */
    public function serveFile(Request $request, MemoriesMap $map, MediaFile $media): BinaryFileResponse|Response
    {
        $this->authorize('view', $map);
        $this->ensureBelongsToMap($media, $map);

        $path = $this->processor->storagePath($media->stored_name);

        abort_unless(file_exists($path), 404);

        if ($this->processor->isEncryptedFile($path)) {
            return response($this->processor->readDecryptedContents($path), 200, [
                'Content-Type' => $media->mime_type,
                'Cache-Control' => 'private, no-store, max-age=0',
            ]);
        }

        return response()->file($path, [
            'Content-Type' => $media->mime_type,
        ]);
    }

    /**
     * Serve media file for <img>/<video> tags using token query auth.
     */
    public function serveFileToken(Request $request, MemoriesMap $map, MediaFile $media): BinaryFileResponse|Response
    {
        $this->ensureBelongsToMap($media, $map);
        $this->authorizeMapByToken($request, $map);

        $path = $this->processor->storagePath($media->stored_name);
        abort_unless(file_exists($path), 404);

        if ($this->processor->isEncryptedFile($path)) {
            return response($this->processor->readDecryptedContents($path), 200, [
                'Content-Type' => $media->mime_type,
                'Cache-Control' => 'private, no-store, max-age=0',
            ]);
        }

        return response()->file($path, [
            'Content-Type' => $media->mime_type,
        ]);
    }

    /** Serve the thumbnail (also accessible to guests). */
    public function serveThumbnail(MemoriesMap $map, MediaFile $media): BinaryFileResponse|Response
    {
        $this->ensureBelongsToMap($media, $map);

        $path = $this->processor->thumbnailPath($media->thumbnail_name);

        abort_unless($path && file_exists($path), 404);

        if ($this->processor->isEncryptedFile($path)) {
            return response($this->processor->readDecryptedContents($path), 200, [
                'Content-Type' => 'image/webp',
                'Cache-Control' => 'private, no-store, max-age=0',
            ]);
        }

        return response()->file($path, ['Content-Type' => 'image/webp']);
    }

    /**
     * Serve thumbnail for <img> tags using token query auth.
     */
    public function serveThumbnailToken(Request $request, MemoriesMap $map, MediaFile $media): BinaryFileResponse|Response
    {
        $this->ensureBelongsToMap($media, $map);
        $this->authorizeMapByToken($request, $map);

        $path = $this->processor->thumbnailPath($media->thumbnail_name);
        abort_unless($path && file_exists($path), 404);

        if ($this->processor->isEncryptedFile($path)) {
            return response($this->processor->readDecryptedContents($path), 200, [
                'Content-Type' => 'image/webp',
                'Cache-Control' => 'private, no-store, max-age=0',
            ]);
        }

        return response()->file($path, ['Content-Type' => 'image/webp']);
    }

    public function indexShared(MemoriesMap $map): JsonResponse
    {
        $media = $map->mediaFiles()
            ->select(
                'id',
                'map_id',
                'original_name',
                'mime_type',
                'size_bytes',
                'latitude',
                'longitude',
                'location_name',
                'location_city',
                'captured_at',
                'captured_at_local',
                'timezone',
                'user_caption',
                'thumbnail_name',
                'width',
                'height',
                'duration_seconds'
            )
            ->orderBy('captured_at')
            ->get()
            ->map(function (MediaFile $item): MediaFile {
                if ($item->thumbnail_name && !$this->mediaThumbnailExists($item)) {
                    $item->thumbnail_name = null;
                }

                return $item;
            })
            ->values();

        return response()->json(['data' => $media]);
    }

    private function mediaThumbnailExists(MediaFile $media): bool
    {
        $thumbPath = $this->processor->thumbnailPath($media->thumbnail_name);
        return $thumbPath !== null && is_file($thumbPath);
    }

    private function ensureBelongsToMap(MediaFile $media, MemoriesMap $map): void
    {
        abort_if($media->map_id !== $map->id, 404);
    }

    /**
     * Authenticate map owner from bearer header or `token` query string.
     */
    private function authorizeMapByToken(Request $request, MemoriesMap $map): void
    {
        $user = $request->user();

        if (! $user) {
            $plainTextToken = (string) $request->query('token', '');
            $accessToken = PersonalAccessToken::findToken($plainTextToken);

            if ($accessToken) {
                $expired = $accessToken->expires_at && $accessToken->expires_at->isPast();
                if (! $expired && $accessToken->tokenable instanceof User) {
                    $accessToken->forceFill(['last_used_at' => now()])->save();
                    $user = $accessToken->tokenable;
                }
            }
        }

        abort_unless($user instanceof User && (int) $user->id === (int) $map->user_id, 403);
    }
}
