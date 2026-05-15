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

    public function __construct()
    {
        $this->storagePath = rtrim(config('filesystems.media_storage_path'), '/\\');
        $this->thumbPath   = $this->storagePath . DIRECTORY_SEPARATOR . 'thumbnails';

        foreach ([$this->storagePath, $this->thumbPath] as $dir) {
            if (! is_dir($dir)) {
                mkdir($dir, 0750, true);
            }
        }
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
            $attrs['exif_json'] = $safe;
        }

        // Dimensions
        [$w, $h] = @getimagesize($path) ?: [null, null];
        $attrs['width']  = $w;
        $attrs['height'] = $h;

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
}
