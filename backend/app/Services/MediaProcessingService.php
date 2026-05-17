<?php

namespace App\Services;

use App\Models\MediaFile;
use App\Models\MemoriesMap;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;

class MediaProcessingService
{
    private readonly string $storagePath;
    private readonly string $thumbPath;
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

        $this->storagePath = $this->resolveWritableStoragePath($candidates);
        $this->thumbPath   = $this->storagePath . DIRECTORY_SEPARATOR . 'thumbnails';
    }

    /**
     * Pick the first path that can be created and written by the running PHP user.
     * This keeps local Docker/dev usable even when MEDIA_STORAGE_PATH is misconfigured.
     */
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

            if ($baseOk && $thumbOk && is_writable($base) && is_writable($thumb)) {
                return $base;
            }
        }

        throw new \RuntimeException('No writable media storage path is available.');
    }

    /**
     * Ingest a freshly uploaded file, extract metadata, generate thumbnail.
     */
    public function ingest(UploadedFile $upload, MemoriesMap $map): MediaFile
    {
        $storedName = Str::uuid() . '.' . $upload->getClientOriginalExtension();
        $upload->move($this->storagePath, $storedName);

        $fullPath = $this->storagePath . DIRECTORY_SEPARATOR . $storedName;
        $mime     = mime_content_type($fullPath) ?: $upload->getMimeType();

        $attributes = [
            'map_id'        => $map->id,
            'original_name' => $upload->getClientOriginalName(),
            'stored_name'   => $storedName,
            'mime_type'     => $mime,
            'size_bytes'    => filesize($fullPath),
        ];

        if (str_starts_with($mime, 'image/')) {
            $attributes = array_merge($attributes, $this->extractImageMeta($fullPath));
            $attributes['thumbnail_name'] = $this->generateImageThumbnail($fullPath, $storedName);
        } elseif (str_starts_with($mime, 'video/')) {
            $attributes = array_merge($attributes, $this->extractVideoMeta($fullPath));
            $attributes['thumbnail_name'] = $this->generateVideoThumbnail($fullPath, $storedName);
        }

        $attributes['processed_at'] = now();

        return MediaFile::create($attributes);
    }

    /**
     * Delete the media file and its thumbnail from disk.
     */
    public function delete(MediaFile $media): void
    {
        $files = [
            $this->storagePath . DIRECTORY_SEPARATOR . $media->stored_name,
            $media->thumbnail_name
                ? $this->thumbPath . DIRECTORY_SEPARATOR . $media->thumbnail_name
                : null,
        ];

        foreach (array_filter($files) as $path) {
            if (file_exists($path)) {
                unlink($path);
            }
        }

        $media->delete();
    }

    /**
     * Rescan an existing media file for location data.
     * Only geocodes if file has GPS but is missing enhanced location data.
     * Results are saved directly to the database for persistence.
     */
    public function rescanForLocation(MediaFile $media): bool
    {
        // Skip if no GPS coordinates
        if ($media->latitude === null || $media->longitude === null) {
            return false;
        }

        // Skip if already has enhanced location data
        if (!empty($media->location_name)) {
            return false;
        }

        // Geocode and save to database
        $location = $this->geocoder->reverseGeocode($media->latitude, $media->longitude);
        
        if ($location) {
            $media->update([
                'location_name' => $location['name'],
                'location_address' => $location['address'],
                'location_city' => $location['city'],
                'location_country' => $location['country'],
            ]);
            return true;
        }

        return false;
    }

    /**
     * Calculate timezone and local time from GPS coordinates and captured_at timestamp.
     * Modifies the attributes array in place.
     */
    private function calculateTimezoneData(array &$attrs): void
    {
        // Need both GPS coordinates and a capture timestamp
        if (empty($attrs['latitude']) || empty($attrs['longitude']) || empty($attrs['captured_at'])) {
            return;
        }

        $tzData = $this->timezone->getTimezoneFromCoordinates(
            $attrs['latitude'],
            $attrs['longitude']
        );

        if (!$tzData) {
            return;
        }

        $attrs['timezone'] = $tzData['timezone'];
        $attrs['timezone_offset'] = $tzData['offset'];

        // Convert captured_at (UTC) to local time
        try {
            $utcTime = $attrs['captured_at'];
            if ($utcTime instanceof \Carbon\Carbon) {
                $utcTime = $utcTime->toDateTime();
            } elseif (is_string($utcTime)) {
                $utcTime = new \DateTime($utcTime);
            }

            $localTime = $this->timezone->convertToLocalTime($utcTime, $tzData['timezone']);
            if ($localTime) {
                $attrs['captured_at_local'] = \Carbon\Carbon::instance($localTime);
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to calculate local time', [
                'latitude' => $attrs['latitude'],
                'longitude' => $attrs['longitude'],
                'timezone' => $tzData['timezone'],
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function storagePath(string $filename): string
    {
        return $this->storagePath . DIRECTORY_SEPARATOR . $filename;
    }

    public function thumbnailPath(?string $filename): ?string
    {
        if (! $filename) {
            return null;
        }
        return $this->thumbPath . DIRECTORY_SEPARATOR . $filename;
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function extractImageMeta(string $path): array
    {
        $attrs = [];

        $exif = @exif_read_data($path, 'ANY_TAG', true);

        if ($exif) {
            // GPS
            if (isset($exif['GPS'])) {
                $gps = $exif['GPS'];
                $attrs['latitude']  = $this->gpsToDecimal($gps['GPSLatitude'] ?? null, $gps['GPSLatitudeRef'] ?? 'N');
                $attrs['longitude'] = $this->gpsToDecimal($gps['GPSLongitude'] ?? null, $gps['GPSLongitudeRef'] ?? 'E');
                $attrs['altitude']  = isset($gps['GPSAltitude']) ? $this->rationalToFloat($gps['GPSAltitude']) : null;

                // Reverse geocode to get location details
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

            // Timestamp
            $dateStr = $exif['EXIF']['DateTimeOriginal']
                ?? $exif['IFD0']['DateTime']
                ?? null;
            if ($dateStr) {
                try {
                    $attrs['captured_at'] = \Carbon\Carbon::createFromFormat('Y:m:d H:i:s', $dateStr);
                } catch (\Throwable) {}
            }

            // Camera
            $attrs['camera_make']  = $exif['IFD0']['Make'] ?? null;
            $attrs['camera_model'] = $exif['IFD0']['Model'] ?? null;

            // Store sanitised EXIF (remove binary/thumbnail blobs)
            $safe = $exif;
            unset($safe['THUMBNAIL']);

            // EXIF data can contain non-UTF8 byte sequences that break JSON encoding.
            $safe = $this->sanitizeForJson($safe);
            $attrs['exif_json'] = $this->isJsonEncodable($safe) ? $safe : null;
        }

        // Dimensions
        [$w, $h] = @getimagesize($path) ?: [null, null];
        $attrs['width']  = $w;
        $attrs['height'] = $h;

        // Calculate timezone and local time if we have GPS and timestamp
        $this->calculateTimezoneData($attrs);

        return array_filter($attrs, fn ($v) => $v !== null);
    }

    private function extractVideoMeta(string $path): array
    {
        // ffprobe must be available; graceful fallback if not.
        $attrs = [];

        if (! $this->ffprobeAvailable()) {
            return $attrs;
        }

        $json = shell_exec(
            'ffprobe -v quiet -print_format json -show_streams -show_format ' . escapeshellarg($path)
        );

        if (! $json) {
            return $attrs;
        }

        $data = json_decode($json, true);

        $attrs['duration_seconds'] = (float) ($data['format']['duration'] ?? 0);

        // GPS from metadata tags
        $tags = $data['format']['tags'] ?? [];
        if (isset($tags['location'])) {
            preg_match('/([+-][0-9.]+)([+-][0-9.]+)/', $tags['location'], $m);
            if (count($m) >= 3) {
                $attrs['latitude']  = (float) $m[1];
                $attrs['longitude'] = (float) $m[2];

                // Reverse geocode to get location details
                $location = $this->geocoder->reverseGeocode($attrs['latitude'], $attrs['longitude']);
                if ($location) {
                    $attrs['location_name'] = $location['name'];
                    $attrs['location_address'] = $location['address'];
                    $attrs['location_city'] = $location['city'];
                    $attrs['location_country'] = $location['country'];
                }
            }
        }

        // Capture date
        $dateStr = $tags['creation_time'] ?? null;
        if ($dateStr) {
            try {
                $attrs['captured_at'] = \Carbon\Carbon::parse($dateStr);
            } catch (\Throwable) {}
        }

        foreach ($data['streams'] ?? [] as $stream) {
            if ($stream['codec_type'] === 'video') {
                $attrs['width']  = $stream['width'] ?? null;
                $attrs['height'] = $stream['height'] ?? null;
                break;
            }
        }

        // Calculate timezone and local time if we have GPS and timestamp
        $this->calculateTimezoneData($attrs);

        return array_filter($attrs, fn ($v) => $v !== null);
    }

    private function generateImageThumbnail(string $sourcePath, string $storedName): string
    {
        $thumbName = pathinfo($storedName, PATHINFO_FILENAME) . '_thumb.webp';
        $destPath  = $this->thumbPath . DIRECTORY_SEPARATOR . $thumbName;

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
        if (! $this->ffmpegAvailable()) {
            return '';
        }

        $thumbName = pathinfo($storedName, PATHINFO_FILENAME) . '_thumb.webp';
        $destPath  = $this->thumbPath . DIRECTORY_SEPARATOR . $thumbName;

        exec(
            'ffmpeg -y -i ' . escapeshellarg($sourcePath) .
            ' -ss 00:00:01 -vframes 1 -vf "scale=400:300:force_original_aspect_ratio=decrease" ' .
            escapeshellarg($destPath) . ' 2>/dev/null'
        );

        return file_exists($destPath) ? $thumbName : '';
    }

    private function gpsToDecimal(?array $parts, string $ref): ?float
    {
        if (! $parts || count($parts) < 3) {
            return null;
        }

        $degrees = $this->rationalToFloat($parts[0]);
        $minutes = $this->rationalToFloat($parts[1]);
        $seconds = $this->rationalToFloat($parts[2]);

        $decimal = $degrees + ($minutes / 60) + ($seconds / 3600);

        return in_array(strtoupper($ref), ['S', 'W']) ? -$decimal : $decimal;
    }

    private function rationalToFloat(string $rational): float
    {
        if (str_contains($rational, '/')) {
            [$num, $den] = explode('/', $rational);
            return $den != 0 ? (float) $num / (float) $den : 0.0;
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

    /**
     * Recursively sanitize values so they can be safely JSON encoded.
     * Non-UTF8 strings are converted to UTF-8 with invalid bytes stripped.
     */
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
            // If the string is not valid UTF-8, treat it as ISO-8859-1 (EXIF default).
            // ISO-8859-1 → UTF-8 conversion always succeeds since every byte is defined.
            if (!mb_check_encoding($value, 'UTF-8')) {
                $value = mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
            }
            // Strip null bytes and control characters that are invalid in JSON
            // (U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F).
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
