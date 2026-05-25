<?php

namespace App\Console\Commands;

use App\Jobs\ProcessMediaPipelineJob;
use App\Models\MediaFile;
use Illuminate\Console\Command;

class RequeueStuckMedia extends Command
{
    protected $signature = 'media:requeue-stuck {--map-id= : Requeue only one map} {--limit=0 : Limit how many items to requeue}';

    protected $description = 'Repair stale processing statuses and requeue media items that are still unprocessed';

    public function handle(): int
    {
        $mapId = $this->option('map-id');
        $limit = (int) $this->option('limit');

        $repairQuery = MediaFile::query()
            ->whereNotNull('processed_at')
            ->where('processing_status', '!=', MediaFile::PROCESSING_COMPLETED);

        if ($mapId !== null && $mapId !== '') {
            $repairQuery->where('map_id', (int) $mapId);
        }

        $repaired = $repairQuery->update([
            'processing_status' => MediaFile::PROCESSING_COMPLETED,
            'processing_stage' => 'complete',
            'processing_finished_at' => now(),
            'processing_error' => null,
        ]);

        $dispatchQuery = MediaFile::query()
            ->whereNull('processed_at')
            ->whereIn('processing_status', [
                MediaFile::PROCESSING_QUEUED,
                MediaFile::PROCESSING_FAILED,
            ])
            ->orderBy('id');

        if ($mapId !== null && $mapId !== '') {
            $dispatchQuery->where('map_id', (int) $mapId);
        }

        if ($limit > 0) {
            $dispatchQuery->limit($limit);
        }

        $mediaIds = $dispatchQuery->pluck('id');

        foreach ($mediaIds as $mediaId) {
            ProcessMediaPipelineJob::dispatch((int) $mediaId)
                ->onQueue((string) config('app.media_processing_queue', 'media-processing'));
        }

        if ($repaired === 0 && $mediaIds->isEmpty()) {
            $this->info('No stale or stuck media items found.');
            return self::SUCCESS;
        }

        if ($repaired > 0) {
            $this->info('Repaired ' . $repaired . ' processed media item(s) with stale queue status.');
        }

        if (!$mediaIds->isEmpty()) {
            $this->info('Requeued ' . $mediaIds->count() . ' unprocessed media item(s).');
        }

        return self::SUCCESS;
    }
}