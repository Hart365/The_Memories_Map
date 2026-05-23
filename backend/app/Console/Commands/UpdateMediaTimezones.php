<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Services\TimezoneService;
use Illuminate\Console\Command;

class UpdateMediaTimezones extends Command
{
    protected $signature = 'media:update-timezones 
                            {--force : Update even if timezone already set}
                            {--limit= : Limit number of files to process}
                            {--user-id= : Only process media belonging to this user ID}';

    protected $description = 'Recalculate UTC/local capture times for existing media using user default timezone and media location timezone';

    public function handle(TimezoneService $timezoneService): int
    {
        $this->info('🌍 Updating media file timezones...');

        $query = MediaFile::with('map.user')
            ->whereNotNull('captured_at');

        if ($userId = $this->option('user-id')) {
            $query->whereHas('map', function ($q) use ($userId) {
                $q->where('user_id', (int) $userId);
            });
        }

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
        $totalDifferenceMinutes = 0;

        foreach ($media as $file) {
            try {
                $sourceTimezone = $file->map?->user?->default_timezone ?? TimezoneService::DEFAULT_TIMEZONE;

                $tzData = null;
                if ($file->latitude !== null && $file->longitude !== null) {
                    $tzData = $timezoneService->getTimezoneFromCoordinates(
                        $file->latitude,
                        $file->longitude
                    );
                }

                $targetTimezone = $tzData['timezone'] ?? $file->timezone ?? $sourceTimezone;

                $dateStr = data_get($file->exif_json, 'EXIF.DateTimeOriginal')
                    ?? data_get($file->exif_json, 'IFD0.DateTime');

                $capturedAtUtc = null;
                if (is_string($dateStr) && preg_match('/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/', $dateStr)) {
                    $capturedAtUtc = $timezoneService->parseCameraLocalToUtc($dateStr, $sourceTimezone);
                } elseif ($file->captured_at) {
                    $capturedAtUtc = $file->captured_at->copy()->setTimezone('UTC');
                }

                if (!$capturedAtUtc) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                $sourceLocal = $capturedAtUtc->copy()->setTimezone($sourceTimezone);
                $locationLocal = $capturedAtUtc->copy()->setTimezone($targetTimezone);

                $file->update([
                    'captured_at' => $capturedAtUtc,
                    'timezone' => $targetTimezone,
                    'timezone_offset' => $locationLocal->utcOffset(),
                    'captured_at_local' => $sourceLocal,
                ]);

                $totalDifferenceMinutes += ($locationLocal->utcOffset() - $sourceLocal->utcOffset());
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
        if ($updated > 0) {
            $avgDiff = round($totalDifferenceMinutes / $updated, 1);
            $this->info("ℹ️  Average source→location offset delta (minutes): {$avgDiff}");
        }
        if ($skipped > 0) {
            $this->warn("⚠️  Skipped (missing source timestamp): {$skipped}");
        }
        if ($failed > 0) {
            $this->error("❌ Failed: {$failed}");
        }

        return self::SUCCESS;
    }
}
