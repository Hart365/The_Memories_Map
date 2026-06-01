<?php

namespace App\Services;

use App\Jobs\ProcessMediaPipelineJob;
use App\Models\MediaFile;
use App\Models\MemoriesMap;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\ImageManager;
use RuntimeException;

class MediaProcessingService
{
    private const ENCRYPTION_MAGIC = 'MMAPENC1';
    private const ENCRYPTION_CIPHER = 'aes-256-gcm';

    private readonly string $storagePath;
    private readonly string $thumbPath;
    /** @var list<string> */
    private readonly array $storageCandidates;
    private readonly bool $encryptionEnabled;
    private readonly string $encryptionKey;
    private readonly GeocodingService $geocoder;
    private readonly TimezoneService $timezone;

    public function __construct(GeocodingService $geocoder, TimezoneService $timezone)
    {
        $this->geocoder = $geocoder;
        $this->timezone = $timezone;

        $configuredPath = (string) config('filesystems.media_storage_path', '');
        $fallbackPath = storage_path('app/private/media');
        $candidates = array_values(array_unique(array_filter([
            trim($configuredPath),
            $fallbackPath,
        ])));

        $this->storageCandidates = array_map(
            static fn (string $path): string => rtrim($path, '/\\'),
            $candidates,
        );
        $this->storagePath = $this->resolveWritableStoragePath($this->storageCandidates);
        $this->thumbPath = $this->storagePath . DIRECTORY_SEPARATOR . 'thumbnails';
        $this->encryptionEnabled = (bool) config('filesystems.media_encryption_enabled', true);
        $this->encryptionKey = $this->resolveEncryptionKey();
    }

    public function ingest(UploadedFile $upload, MemoriesMap $map): MediaFile
    {
        $mapPrefix = $this->mapStoragePrefix($map);
        $targetDir = $this->storagePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $mapPrefix);
        $this->ensureDirectory($targetDir);

        $clientMime = null;
        try {
            $clientMime = $upload->getClientMimeType();
        } catch (\Throwable) {
            $clientMime = null;
        }

        $storedFileName = Str::uuid() . '.' . $upload->getClientOriginalExtension();
        $upload->move($targetDir, $storedFileName);

        $storedName = $mapPrefix . '/' . $storedFileName;
        $fullPath = $targetDir . DIRECTORY_SEPARATOR . $storedFileName;
        $mime = $this->detectMimeType(
            $fullPath,
            $upload->getClientOriginalExtension(),
            $clientMime,
        );

        $attributes = [
            'map_id' => $map->id,
            'original_name' => $upload->getClientOriginalName(),
            'stored_name' => $storedName,
            'mime_type' => $mime,
            'size_bytes' => filesize($fullPath) ?: null,
            'processing_status' => MediaFile::PROCESSING_QUEUED,
            'processing_stage' => 'queued',
            'processing_attempts' => 0,
            'processing_error' => null,
            'processing_started_at' => null,
            'processing_finished_at' => null,
        ];

        $this->encryptFileAtRest($fullPath);

        $media = MediaFile::create($attributes);

        ProcessMediaPipelineJob::dispatch($media->id)
            ->onQueue((string) config('app.media_processing_queue', 'media-processing'));

        return $media->fresh() ?? $media;
    }

    public function processQueuedMedia(MediaFile $media): void
    {
        if ($media->processing_status === MediaFile::PROCESSING_COMPLETED && $media->processed_at !== null) {
            return;
        }

        $sourcePath = $this->storagePath($media->stored_name);
        if (!is_file($sourcePath)) {
            throw new RuntimeException('Media source file is missing for processing.');
        }

        $mime = $this->detectMimeType(
            $sourcePath,
            pathinfo($media->stored_name, PATHINFO_EXTENSION),
            $media->mime_type,
        );

        $attributes = [
            'mime_type' => $mime,
            'size_bytes' => filesize($sourcePath) ?: $media->size_bytes,
            'processing_status' => MediaFile::PROCESSING_PROCESSING,
            'processing_stage' => 'metadata',
            'processing_error' => null,
            'processing_started_at' => $media->processing_started_at ?? now(),
            'processing_finished_at' => null,
        ];

        if (str_starts_with($mime, 'image/')) {
            $sourceTimezone = $media->map?->user?->default_timezone ?? TimezoneService::DEFAULT_TIMEZONE;
            $attributes = array_merge($attributes, $this->extractImageMeta($sourcePath, $sourceTimezone));
            $attributes['processing_stage'] = 'thumbnail';

            $thumbnail = $this->generateImageThumbnail($sourcePath, $media->stored_name);
            if ($thumbnail !== '') {
                $attributes['thumbnail_name'] = $thumbnail;
            }
        } elseif (str_starts_with($mime, 'video/')) {
            $attributes = array_merge($attributes, $this->extractVideoMeta($sourcePath));
            $attributes['processing_stage'] = 'thumbnail';

            $thumbnail = $this->generateVideoThumbnail($sourcePath, $media->stored_name);
            if ($thumbnail !== '') {
                $attributes['thumbnail_name'] = $thumbnail;
            }
        }

        $this->encryptFileAtRest($sourcePath);
        if (!empty($attributes['thumbnail_name'])) {
            $this->encryptFileAtRest($this->thumbnailAbsolutePath((string) $attributes['thumbnail_name']));
        }

        $attributes['processed_at'] = now();
        $attributes['processing_status'] = MediaFile::PROCESSING_COMPLETED;
        $attributes['processing_stage'] = 'complete';
        $attributes['processing_finished_at'] = now();

        $media->forceFill($attributes)->save();
    }

    public function delete(MediaFile $media): void
    {
        $paths = $this->allCandidatePaths($media->stored_name);

        if ($media->thumbnail_name) {
            $paths = array_merge($paths, $this->allCandidateThumbnailPaths($media->thumbnail_name));
        }

        foreach (array_values(array_unique(array_filter($paths))) as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }

        $media->notes()->withTrashed()->forceDelete();
        $media->forceDelete();
    }

    public function rescanForLocation(MediaFile $media): bool
    {
        if ($media->latitude === null || $media->longitude === null) {
            return false;
        }

        if (!empty($media->location_name)) {
            return false;
        }

        $location = $this->geocoder->reverseGeocode($media->latitude, $media->longitude);
        if (!$location) {
            return false;
        }

        $media->update([
            'location_name' => $location['name'],
            'location_address' => $location['address'],
            'location_city' => $location['city'],
            'location_country' => $location['country'],
        ]);

        return true;
    }

    public function storagePath(string $filename): string
    {
        $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, ltrim($filename, '/\\'));

        foreach ($this->storageCandidates as $candidate) {
            $path = $candidate . DIRECTORY_SEPARATOR . $normalized;
            if (is_file($path)) {
                return $path;
            }
        }

        return $this->storagePath . DIRECTORY_SEPARATOR . $normalized;
    }

    public function thumbnailPath(?string $filename): ?string
    {
        if (!$filename) {
            return null;
        }

        $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, ltrim($filename, '/\\'));

        if (str_contains(str_replace('\\', '/', $filename), '/')) {
            foreach ($this->storageCandidates as $candidate) {
                $path = $candidate . DIRECTORY_SEPARATOR . $normalized;
                if (is_file($path)) {
                    return $path;
                }
            }
        }

        foreach ($this->storageCandidates as $candidate) {
            $legacy = $candidate . DIRECTORY_SEPARATOR . 'thumbnails' . DIRECTORY_SEPARATOR . basename($normalized);
            if (is_file($legacy)) {
                return $legacy;
            }
        }

        return $this->thumbPath . DIRECTORY_SEPARATOR . basename($normalized);
    }

    public function isEncryptedFile(string $path): bool
    {
        if (!is_file($path)) {
            return false;
        }

        $handle = @fopen($path, 'rb');
        if (!$handle) {
            return false;
        }

        $prefix = fread($handle, strlen(self::ENCRYPTION_MAGIC));
        fclose($handle);

        return $prefix === self::ENCRYPTION_MAGIC;
    }

    public function readDecryptedContents(string $path): string
    {
        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException('Unable to read media file from storage.');
        }

        return $this->isEncryptedBlob($bytes) ? $this->decryptBytes($bytes) : $bytes;
    }

    public function encryptPathIfNeeded(string $path): bool
    {
        if (!is_file($path) || $this->isEncryptedFile($path)) {
            return false;
        }

        $this->encryptFileAtRest($path);
        return $this->isEncryptedFile($path);
    }

    private function resolveWritableStoragePath(array $candidates): string
    {
        foreach ($candidates as $candidate) {
            $base = rtrim($candidate, '/\\');
            if ($base === '') {
                continue;
            }

            $thumb = $base . DIRECTORY_SEPARATOR . 'thumbnails';
            $baseOk = is_dir($base) || @mkdir($base, 0750, true);
            $thumbOk = is_dir($thumb) || @mkdir($thumb, 0750, true);

            if ($baseOk) {
                $this->syncDirectoryAccess($base);
            }
            if ($thumbOk) {
                $this->syncDirectoryAccess($thumb);
            }

            if ($baseOk && $thumbOk && is_writable($base) && is_writable($thumb)) {
                return $base;
            }
        }

        throw new RuntimeException('No writable media storage path is available.');
    }

    private function calculateTimezoneData(array &$attrs, ?string $sourceTimezone = null): void
    {
        if (empty($attrs['latitude']) || empty($attrs['longitude']) || empty($attrs['captured_at'])) {
            return;
        }

        $tzData = $this->timezone->getTimezoneFromCoordinates($attrs['latitude'], $attrs['longitude']);
        if (!$tzData) {
            return;
        }

        $attrs['timezone'] = $tzData['timezone'];

        try {
            $capturedAt = $attrs['captured_at'];
            $capturedAtUtc = $capturedAt instanceof Carbon
                ? $capturedAt->copy()->setTimezone('UTC')
                : Carbon::parse((string) $capturedAt, 'UTC');

            $sourceTz = $sourceTimezone ?: TimezoneService::DEFAULT_TIMEZONE;
            $attrs['captured_at'] = $capturedAtUtc;
            $attrs['captured_at_local'] = $capturedAtUtc->copy()->setTimezone($sourceTz);

            $locationLocal = $capturedAtUtc->copy()->setTimezone($tzData['timezone']);
            $attrs['timezone_offset'] = (int) $locationLocal->utcOffset();
        } catch (\Throwable $e) {
            \Log::warning('Failed to calculate local time', [
                'latitude' => $attrs['latitude'],
                'longitude' => $attrs['longitude'],
                'timezone' => $tzData['timezone'],
                'source_timezone' => $sourceTimezone,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** @return list<string> */
    private function allCandidatePaths(string $filename): array
    {
        $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, ltrim($filename, '/\\'));
        $paths = [];

        foreach ($this->storageCandidates as $candidate) {
            $paths[] = $candidate . DIRECTORY_SEPARATOR . $normalized;
        }

        return array_values(array_unique($paths));
    }

    /** @return list<string> */
    private function allCandidateThumbnailPaths(string $filename): array
    {
        $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, ltrim($filename, '/\\'));
        $paths = [];

        foreach ($this->storageCandidates as $candidate) {
            if (str_contains(str_replace('\\', '/', $filename), '/')) {
                $paths[] = $candidate . DIRECTORY_SEPARATOR . $normalized;
            }

            $paths[] = $candidate . DIRECTORY_SEPARATOR . 'thumbnails' . DIRECTORY_SEPARATOR . basename($normalized);
        }

        return array_values(array_unique($paths));
    }

    private function mapStoragePrefix(MemoriesMap $map): string
    {
        $uid = trim((string) ($map->map_uid ?? ''));
        return $uid !== '' ? $uid : 'map-' . $map->id;
    }

    private function ensureDirectory(string $path): void
    {
        if (!is_dir($path)) {
            @mkdir($path, 0750, true);
        }

        $this->syncDirectoryAccess($path);
    }

    private function syncDirectoryAccess(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $parent = dirname($path);
        $perms = @fileperms($parent);
        if ($perms !== false) {
            @chmod($path, $perms & 0777);
        }

        $owner = @fileowner($parent);
        if ($owner !== false) {
            @chown($path, $owner);
        }

        $group = @filegroup($parent);
        if ($group !== false) {
            @chgrp($path, $group);
        }
    }

    private function resolveEncryptionKey(): string
    {
        $configured = (string) config('filesystems.media_encryption_key', '');
        $raw = $this->decodeKeyMaterial($configured);

        if ($raw === '') {
            $raw = $this->decodeKeyMaterial((string) config('app.key', ''));
        }

        if ($raw === '') {
            throw new RuntimeException('No valid media encryption key is configured.');
        }

        return hash('sha256', $raw, true);
    }

    private function decodeKeyMaterial(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (str_starts_with($value, 'base64:')) {
            $decoded = base64_decode(substr($value, 7), true);
            return $decoded === false ? '' : $decoded;
        }

        return $value;
    }

    private function encryptFileAtRest(string $path): void
    {
        if (!$this->encryptionEnabled || !is_file($path) || $this->isEncryptedFile($path)) {
            return;
        }

        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            return;
        }

        $encrypted = $this->encryptBytes($bytes);
        @file_put_contents($path, $encrypted, LOCK_EX);
    }

    private function encryptBytes(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $plain,
            self::ENCRYPTION_CIPHER,
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16,
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Failed to encrypt media content.');
        }

        return self::ENCRYPTION_MAGIC . chr(strlen($iv)) . chr(strlen($tag)) . $iv . $tag . $ciphertext;
    }

    private function decryptBytes(string $payload): string
    {
        $magicLen = strlen(self::ENCRYPTION_MAGIC);
        if (strlen($payload) < $magicLen + 2) {
            throw new RuntimeException('Encrypted media payload is malformed.');
        }

        $offset = $magicLen;
        $ivLen = ord($payload[$offset]);
        $offset++;
        $tagLen = ord($payload[$offset]);
        $offset++;

        $required = $magicLen + 2 + $ivLen + $tagLen;
        if (strlen($payload) < $required) {
            throw new RuntimeException('Encrypted media payload is incomplete.');
        }

        $iv = substr($payload, $offset, $ivLen);
        $offset += $ivLen;
        $tag = substr($payload, $offset, $tagLen);
        $offset += $tagLen;
        $ciphertext = substr($payload, $offset);

        $plain = openssl_decrypt(
            $ciphertext,
            self::ENCRYPTION_CIPHER,
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($plain === false) {
            throw new RuntimeException('Unable to decrypt media payload.');
        }

        return $plain;
    }

    private function isEncryptedBlob(string $payload): bool
    {
        return str_starts_with($payload, self::ENCRYPTION_MAGIC);
    }

    private function extractImageMeta(string $path, ?string $sourceTimezone = null): array
    {
        $attrs = [];
        $exif = @exif_read_data($path, 'ANY_TAG', true);

        if ($exif) {
            if (isset($exif['GPS'])) {
                $gps = $exif['GPS'];
                $attrs['latitude'] = $this->gpsToDecimal($gps['GPSLatitude'] ?? null, $gps['GPSLatitudeRef'] ?? 'N');
                $attrs['longitude'] = $this->gpsToDecimal($gps['GPSLongitude'] ?? null, $gps['GPSLongitudeRef'] ?? 'E');
                $attrs['altitude'] = isset($gps['GPSAltitude']) ? $this->rationalToFloat((string) $gps['GPSAltitude']) : null;

                if ($attrs['latitude'] && $attrs['longitude']) {
                    $location = $this->geocoder->reverseGeocode($attrs['latitude'], $attrs['longitude']);
                    if ($location) {
                        $attrs['location_name'] = $location['name'];
                        $attrs['location_address'] = $location['address'];
                        $attrs['location_city'] = $location['city'];
                        $attrs['location_country'] = $location['country'];
                    }
                }
            }

            $dateStr = $exif['EXIF']['DateTimeOriginal'] ?? $exif['IFD0']['DateTime'] ?? null;
            if ($dateStr) {
                $capturedAtUtc = $this->timezone->parseCameraLocalToUtc($dateStr, $sourceTimezone);
                if ($capturedAtUtc) {
                    $attrs['captured_at'] = $capturedAtUtc;
                }
            }

            $attrs['camera_make'] = $exif['IFD0']['Make'] ?? null;
            $attrs['camera_model'] = $exif['IFD0']['Model'] ?? null;

            $safe = $exif;
            unset($safe['THUMBNAIL']);
            $safe = $this->sanitizeForJson($safe);
            $attrs['exif_json'] = $this->isJsonEncodable($safe) ? $safe : null;
        }

        [$width, $height] = @getimagesize($path) ?: [null, null];
        $attrs['width'] = $width;
        $attrs['height'] = $height;

        $this->calculateTimezoneData($attrs, $sourceTimezone);

        return array_filter($attrs, static fn ($value) => $value !== null);
    }

    private function extractVideoMeta(string $path): array
    {
        if (!$this->ffprobeAvailable()) {
            return [];
        }

        $json = shell_exec('ffprobe -v quiet -print_format json -show_streams -show_format ' . escapeshellarg($path));
        if (!$json) {
            return [];
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            return [];
        }

        $attrs = [
            'duration_seconds' => (float) ($data['format']['duration'] ?? 0),
        ];

        $tags = $data['format']['tags'] ?? [];
        if (isset($tags['location'])) {
            preg_match('/([+-][0-9.]+)([+-][0-9.]+)/', (string) $tags['location'], $matches);
            if (count($matches) >= 3) {
                $attrs['latitude'] = (float) $matches[1];
                $attrs['longitude'] = (float) $matches[2];

                $location = $this->geocoder->reverseGeocode($attrs['latitude'], $attrs['longitude']);
                if ($location) {
                    $attrs['location_name'] = $location['name'];
                    $attrs['location_address'] = $location['address'];
                    $attrs['location_city'] = $location['city'];
                    $attrs['location_country'] = $location['country'];
                }
            }
        }

        $dateStr = $tags['creation_time'] ?? null;
        if ($dateStr) {
            try {
                $attrs['captured_at'] = Carbon::parse((string) $dateStr);
            } catch (\Throwable) {
            }
        }

        foreach ($data['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? null) === 'video') {
                $attrs['width'] = $stream['width'] ?? null;
                $attrs['height'] = $stream['height'] ?? null;
                break;
            }
        }

        $this->calculateTimezoneData($attrs);

        return array_filter($attrs, static fn ($value) => $value !== null);
    }

    private function generateImageThumbnail(string $sourcePath, string $storedName): string
    {
        $thumbName = $this->thumbnailRelativeName($storedName);
        $destPath = $this->thumbnailAbsolutePath($thumbName);
        $this->ensureDirectory(dirname($destPath));

        try {
            $manager = new ImageManager(new GdDriver());
            $manager->read($sourcePath)
                ->coverDown(400, 300)
                ->toWebp(75)
                ->save($destPath);
        } catch (\Throwable) {
            return '';
        }

        return $thumbName;
    }

    private function generateVideoThumbnail(string $sourcePath, string $storedName): string
    {
        if (!$this->ffmpegAvailable()) {
            return '';
        }

        $thumbName = $this->thumbnailRelativeName($storedName);
        $destPath = $this->thumbnailAbsolutePath($thumbName);
        $this->ensureDirectory(dirname($destPath));

        exec(
            'ffmpeg -y -i ' . escapeshellarg($sourcePath)
            . ' -ss 00:00:01 -vframes 1 -vf "scale=400:300:force_original_aspect_ratio=decrease" '
            . escapeshellarg($destPath)
            . ' 2>/dev/null'
        );

        return is_file($destPath) ? $thumbName : '';
    }

    private function thumbnailRelativeName(string $storedName): string
    {
        $normalized = str_replace('\\', '/', $storedName);
        $directory = trim(dirname($normalized), '. /');
        $baseName = pathinfo($normalized, PATHINFO_FILENAME);

        return ($directory !== '' ? $directory . '/' : '') . 'thumbnails/' . $baseName . '_thumb.webp';
    }

    private function thumbnailAbsolutePath(string $thumbName): string
    {
        return $this->storagePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, ltrim($thumbName, '/'));
    }

    private function gpsToDecimal(?array $parts, string $ref): ?float
    {
        if (!$parts || count($parts) < 3) {
            return null;
        }

        $degrees = $this->rationalToFloat((string) $parts[0]);
        $minutes = $this->rationalToFloat((string) $parts[1]);
        $seconds = $this->rationalToFloat((string) $parts[2]);
        $decimal = $degrees + ($minutes / 60) + ($seconds / 3600);

        return in_array(strtoupper($ref), ['S', 'W'], true) ? -$decimal : $decimal;
    }

    private function rationalToFloat(string $rational): float
    {
        if (str_contains($rational, '/')) {
            [$num, $den] = explode('/', $rational, 2);
            return (float) $den !== 0.0 ? (float) $num / (float) $den : 0.0;
        }

        return (float) $rational;
    }

    private function ffprobeAvailable(): bool
    {
        exec('ffprobe -version 2>&1', $_, $code);
        return $code === 0;
    }

    private function ffmpegAvailable(): bool
    {
        exec('ffmpeg -version 2>&1', $_, $code);
        return $code === 0;
    }

    private function detectMimeType(string $path, ?string $extension = null, ?string $fallbackMime = null): string
    {
        $detected = @mime_content_type($path);
        $mime = is_string($detected) ? strtolower(trim($detected)) : null;

        if ($this->isGenericMimeType($mime)) {
            $mime = null;
        }
        if ($mime !== null) {
            $mime = $this->normalizeMimeAlias($mime);
        }

        $fallback = is_string($fallbackMime) ? strtolower(trim($fallbackMime)) : null;
        if ($mime === null && $fallback !== null && !$this->isGenericMimeType($fallback)) {
            $mime = $this->normalizeMimeAlias($fallback);
        }

        if ($mime === null) {
            $mime = $this->mimeFromExtension($extension);
        }

        return $mime ?? 'application/octet-stream';
    }

    private function normalizeMimeAlias(string $mime): string
    {
        return match ($mime) {
            'application/mp4', 'application/mpeg4' => 'video/mp4',
            'image/jpg' => 'image/jpeg',
            default => $mime,
        };
    }

    private function isGenericMimeType(?string $mime): bool
    {
        if ($mime === null || $mime === '') {
            return true;
        }

        return in_array($mime, [
            'application/octet-stream',
            'binary/octet-stream',
            'application/unknown',
            'application/x-empty',
            'inode/x-empty',
        ], true);
    }

    private function mimeFromExtension(?string $extension): ?string
    {
        if ($extension === null || $extension === '') {
            return null;
        }

        $ext = strtolower(ltrim($extension, '.'));

        return match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'heic' => 'image/heic',
            'heif' => 'image/heif',
            'mp4', 'm4v' => 'video/mp4',
            'mov' => 'video/quicktime',
            'avi' => 'video/x-msvideo',
            'mkv' => 'video/x-matroska',
            default => null,
        };
    }

    private function sanitizeForJson(mixed $value): mixed
    {
        if (is_array($value)) {
            $clean = [];
            foreach ($value as $key => $item) {
                $clean[(string) $key] = $this->sanitizeForJson($item);
            }
            return $clean;
        }

        if (is_string($value)) {
            if (!mb_check_encoding($value, 'UTF-8')) {
                $value = mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
            }

            return (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
        }

        if (is_scalar($value) || $value === null) {
            return $value;
        }

        return (string) $value;
    }

    private function isJsonEncodable(mixed $value): bool
    {
        try {
            json_encode($value, JSON_THROW_ON_ERROR);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
