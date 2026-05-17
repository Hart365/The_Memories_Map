<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Services\TimezoneService;
use Illuminate\Console\Command;

class UpdateMediaTimezones extends Command
{
    protected $signature = 'media:update-timezones 
                            {--force : Update even if timezone already set}
                            {--limit= : Limit number of files to process}';

    protected $description = 'Calculate and set timezone data for existing media files with GPS coordinates';

    public function handle(TimezoneService $timezoneService): int
    {
        $this->info('🌍 Updating media file timezones...');

        $query = MediaFile::whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereNotNull('captured_at');

        if (!$this->option('force')) {
            $query->whereNull('timezone');
        }

        if ($limit = $this->option('limit')) {
            $query->limit((int) $limit);
        }

        $media = $query->get();
        $total = $media->count();

        if ($total === 0) {
            $this->info('✅ No media files need timezone updates.');
            return self::SUCCESS;
        }

        $this->info("Found {$total} media file(s) to process.");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $updated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($media as $file) {
            try {
                $tzData = $timezoneService->getTimezoneFromCoordinates(
                    $file->latitude,
                    $file->longitude
                );

                if (!$tzData) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                // Convert UTC captured_at to local time
                $localTime = null;
                if ($file->captured_at) {
                    $utcTime = $file->captured_at->toDateTime();
                    $localDateTime = $timezoneService->convertToLocalTime($utcTime, $tzData['timezone']);
                    
                    if ($localDateTime) {
                        $localTime = \Carbon\Carbon::instance($localDateTime);
                    }
                }

                $file->update([
                    'timezone' => $tzData['timezone'],
                    'timezone_offset' => $tzData['offset'],
                    'captured_at_local' => $localTime,
                ]);

                $updated++;
            } catch (\Throwable $e) {
                $this->error("\nFailed to update media ID {$file->id}: {$e->getMessage()}");
                $failed++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("✅ Updated: {$updated}");
        if ($skipped > 0) {
            $this->warn("⚠️  Skipped (no timezone found): {$skipped}");
        }
        if ($failed > 0) {
            $this->error("❌ Failed: {$failed}");
        }

        return self::SUCCESS;
    }
}
