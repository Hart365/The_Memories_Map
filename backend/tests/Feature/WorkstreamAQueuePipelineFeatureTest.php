<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MediaFile;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class WorkstreamAQueuePipelineFeatureTest extends TestCase
{
    use DatabaseTransactions;

    public function test_uploads_are_queued_and_status_endpoint_reports_progress(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);

        Sanctum::actingAs($owner);

        $uploadResponse = $this->post('/api/maps/' . $map->id . '/media', [
            'files' => [UploadedFile::fake()->image('queue-pipeline.jpg', 80, 60)],
        ]);

        $uploadResponse->assertCreated();
        $uploadResponse->assertJsonPath('created_count', 1);

        $mediaId = (int) $uploadResponse->json('data.0.id');
        $media = MediaFile::query()->findOrFail($mediaId);

        $this->assertContains($media->processing_status, [
            MediaFile::PROCESSING_QUEUED,
            MediaFile::PROCESSING_PROCESSING,
            MediaFile::PROCESSING_COMPLETED,
        ]);

        $statusBefore = $this->getJson('/api/maps/' . $map->id . '/media/' . $mediaId . '/processing-status');
        $statusBefore->assertOk();
        $beforeStatus = (string) $statusBefore->json('processing_status');
        $this->assertContains($beforeStatus, [
            MediaFile::PROCESSING_QUEUED,
            MediaFile::PROCESSING_PROCESSING,
            MediaFile::PROCESSING_COMPLETED,
        ]);

        if ($beforeStatus !== MediaFile::PROCESSING_COMPLETED) {
            $this->artisan('queue:work', [
                '--queue' => 'media-processing,default',
                '--once' => true,
            ])->assertExitCode(0);
        }

        $media->refresh();

        $this->assertSame(MediaFile::PROCESSING_COMPLETED, $media->processing_status);
        $this->assertNotNull($media->processed_at);

        $statusAfter = $this->getJson('/api/maps/' . $map->id . '/media/' . $mediaId . '/processing-status');
        $statusAfter->assertOk();
        $statusAfter->assertJsonPath('processing_status', MediaFile::PROCESSING_COMPLETED);
        $statusAfter->assertJsonPath('processing_stage', 'complete');
    }

    public function test_failed_job_replay_command_handles_empty_and_invalid_input(): void
    {
        $this->artisan('queue:failed-replay')
            ->assertExitCode(2);

        DB::table('failed_jobs')->delete();

        $this->artisan('queue:failed-replay', ['--all' => true])
            ->assertExitCode(0);
    }
}
