<?php

namespace App\Jobs;

use App\Models\MediaFile;
use App\Services\MediaProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessMediaPipelineJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout;
    public int $tries;
    public int $uniqueFor = 3600;

    public function __construct(public readonly int $mediaId)
    {
        $this->onQueue((string) config('app.media_processing_queue', 'media-processing'));
        $this->timeout = (int) config('app.media_processing_timeout_seconds', 240);
        $this->tries = (int) config('app.media_processing_tries', 5);
    }

    public function uniqueId(): string
    {
        return 'media-pipeline:' . $this->mediaId;
    }

    /** @return list<int> */
    public function backoff(): array
    {
        $configured = (string) config('app.media_processing_backoff_seconds', '10,30,90,180');
        $parts = array_values(array_filter(array_map(static fn (string $item): int => (int) trim($item), explode(',', $configured))));

        return !empty($parts) ? $parts : [10, 30, 90, 180];
    }

    public function handle(MediaProcessingService $processor): void
    {
        $media = MediaFile::query()->with('map.user')->find($this->mediaId);
        if (!$media || $media->trashed()) {
            return;
        }

        if ($media->processing_status === MediaFile::PROCESSING_COMPLETED && $media->processed_at !== null) {
            return;
        }

        $media->forceFill([
            'processing_status' => MediaFile::PROCESSING_PROCESSING,
            'processing_stage' => 'pipeline',
            'processing_attempts' => (int) $media->processing_attempts + 1,
            'processing_error' => null,
            'processing_started_at' => $media->processing_started_at ?? now(),
            'processing_finished_at' => null,
        ])->save();

        $processor->processQueuedMedia($media);
    }

    public function failed(\Throwable $exception): void
    {
        $media = MediaFile::query()->find($this->mediaId);
        if (!$media) {
            return;
        }

        $media->forceFill([
            'processing_status' => MediaFile::PROCESSING_FAILED,
            'processing_stage' => 'failed',
            'processing_error' => mb_substr($exception->getMessage(), 0, 4000),
            'processing_finished_at' => now(),
        ])->save();
    }
}
