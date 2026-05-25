<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Models\MemoriesMap;
use App\Services\MediaProcessingService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class NormalizeMediaStoragePaths extends Command
{
    protected $signature = 'media:normalize-storage-paths
                            {--map-id= : Only process media for one map}
                            {--limit= : Limit number of media rows processed}
                            {--dry-run : Report planned changes without moving files}';

    protected $description = 'Move legacy media files into per-map UID subfolders and update DB paths';

    public function handle(MediaProcessingService $mediaProcessor): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $mapFilter = $this->option('map-id');
        $limit = $this->option('limit');

        $query = MediaFile::with(['map:id,map_uid'])
            ->orderBy('id');

        if ($mapFilter !== null) {
            $query->where('map_id', (int) $mapFilter);
        }

        if ($limit !== null) {
            $query->limit((int) $limit);
        }

        $rows = $query->get();
        $total = $rows->count();

        if ($total === 0) {
            $this->info('No media rows found for normalization.');
            return self::SUCCESS;
        }

        $this->info('Processing ' . $total . ' media row(s)' . ($dryRun ? ' (dry run).' : '.'));
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $moved = 0;
        $skipped = 0;
        $missing = 0;
        $errors = 0;

        foreach ($rows as $media) {
            try {
                $map = $media->map;
                if (!$map instanceof MemoriesMap) {
                    $errors++;
                    $this->newLine();
                    $this->error('Media ID ' . $media->id . ' has no map relation.');
                    $bar->advance();
                    continue;
                }

                if (empty($map->map_uid)) {
                    $map->map_uid = (string) Str::uuid();
                    if (!$dryRun) {
                        $map->save();
                    }
                }

                $mapUid = (string) $map->map_uid;
                $storedName = str_replace('\\', '/', (string) $media->stored_name);
                $targetStoredName = $mapUid . '/' . basename($storedName);

                $thumbName = $media->thumbnail_name ? str_replace('\\', '/', (string) $media->thumbnail_name) : null;
                $targetThumbName = $thumbName ? ($mapUid . '/thumbnails/' . basename($thumbName)) : null;

                $needsStoredMove = $storedName !== $targetStoredName;
                $needsThumbMove = $thumbName !== null && $thumbName !== $targetThumbName;

                if (!$needsStoredMove && !$needsThumbMove) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                $currentStoredPath = $mediaProcessor->storagePath($storedName);
                if (!is_file($currentStoredPath)) {
                    $missing++;
                    $bar->advance();
                    continue;
                }

                $rootPath = $this->resolveRootPath($currentStoredPath, $storedName);
                $newStoredPath = $rootPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetStoredName);

                $currentThumbPath = null;
                $newThumbPath = null;

                if ($thumbName !== null) {
                    $currentThumbPath = $mediaProcessor->thumbnailPath($thumbName);
                    if (!$currentThumbPath || !is_file($currentThumbPath)) {
                        $missing++;
                        $bar->advance();
                        continue;
                    }

                    $newThumbPath = $rootPath
                        . DIRECTORY_SEPARATOR
                        . str_replace('/', DIRECTORY_SEPARATOR, (string) $targetThumbName);
                }

                if ($dryRun) {
                    $moved++;
                    $bar->advance();
                    continue;
                }

                if ($needsStoredMove) {
                    $this->moveFile($currentStoredPath, $newStoredPath);
                }

                if ($needsThumbMove && $currentThumbPath && $newThumbPath) {
                    $this->moveFile($currentThumbPath, $newThumbPath);
                }

                $media->stored_name = $targetStoredName;
                if ($targetThumbName !== null) {
                    $media->thumbnail_name = $targetThumbName;
                }
                $media->save();

                $moved++;
            } catch (\Throwable $e) {
                $errors++;
                $this->newLine();
                $this->error('Failed media ID ' . $media->id . ': ' . $e->getMessage());
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info('Rows normalized: ' . $moved);
        $this->line('Rows skipped (already scoped): ' . $skipped);
        $this->line('Rows missing files: ' . $missing);
        if ($errors > 0) {
            $this->error('Errors: ' . $errors);
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function resolveRootPath(string $absolutePath, string $relativeName): string
    {
        $relativeOs = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($relativeName, '/\\'));

        if ($relativeOs !== '' && str_ends_with($absolutePath, $relativeOs)) {
            $root = rtrim(substr($absolutePath, 0, strlen($absolutePath) - strlen($relativeOs)), DIRECTORY_SEPARATOR);
            if ($root !== '') {
                return $root;
            }
        }

        return dirname($absolutePath);
    }

    private function moveFile(string $source, string $target): void
    {
        if ($source === $target) {
            return;
        }

        $targetDir = dirname($target);
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0750, true);
        }

        if (is_file($target)) {
            @unlink($target);
        }

        if (!@rename($source, $target)) {
            throw new \RuntimeException('Unable to move file from ' . $source . ' to ' . $target);
        }
    }
}
