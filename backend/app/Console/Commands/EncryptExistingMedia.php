<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Services\MediaProcessingService;
use Illuminate\Console\Command;

class EncryptExistingMedia extends Command
{
    protected $signature = 'media:encrypt-existing
                            {--map-id= : Only process media for one map}
                            {--limit= : Limit number of media rows processed}
                            {--dry-run : Report what would be encrypted without writing}';

    protected $description = 'Encrypt existing media originals and thumbnails at rest';

    public function handle(MediaProcessingService $mediaProcessingService): int
    {
        $query = MediaFile::query()->orderBy('id');

        $mapId = $this->option('map-id');
        if ($mapId !== null) {
            $query->where('map_id', (int) $mapId);
        }

        $limit = $this->option('limit');
        if ($limit !== null) {
            $query->limit((int) $limit);
        }

        $mediaRows = $query->get(['id', 'stored_name', 'thumbnail_name']);
        $total = $mediaRows->count();

        if ($total === 0) {
            $this->info('No media rows found for encryption.');
            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $this->info('Processing ' . $total . ' media row(s)' . ($dryRun ? ' (dry run).' : '.'));

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $encryptedFiles = 0;
        $skipped = 0;
        $missing = 0;
        $errors = 0;

        foreach ($mediaRows as $media) {
            try {
                $paths = [];

                $originalPath = $mediaProcessingService->storagePath($media->stored_name);
                if (is_file($originalPath)) {
                    $paths[] = $originalPath;
                } else {
                    $missing++;
                }

                if (!empty($media->thumbnail_name)) {
                    $thumbPath = $mediaProcessingService->thumbnailPath($media->thumbnail_name);
                    if ($thumbPath && is_file($thumbPath)) {
                        $paths[] = $thumbPath;
                    } else {
                        $missing++;
                    }
                }

                if ($dryRun) {
                    $encryptedFiles += count($paths);
                    $bar->advance();
                    continue;
                }

                $changedForRow = 0;
                foreach ($paths as $path) {
                    if ($mediaProcessingService->encryptPathIfNeeded($path)) {
                        $changedForRow++;
                    }
                }

                if ($changedForRow > 0) {
                    $encryptedFiles += $changedForRow;
                } else {
                    $skipped++;
                }
            } catch (\Throwable $e) {
                $errors++;
                $this->newLine();
                $this->error('Failed media ID ' . $media->id . ': ' . $e->getMessage());
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info('Encrypted files: ' . $encryptedFiles);
        $this->line('Already encrypted/unchanged rows: ' . $skipped);
        $this->line('Missing files: ' . $missing);
        if ($errors > 0) {
            $this->error('Errors: ' . $errors);
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
