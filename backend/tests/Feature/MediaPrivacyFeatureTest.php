<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MediaFile;
use App\Models\MapNote;
use App\Services\MediaProcessingService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class MediaPrivacyFeatureTest extends TestCase
{
    use DatabaseTransactions;

    private string $tempMediaRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempMediaRoot = storage_path('framework/testing/media-' . bin2hex(random_bytes(8)));
        File::ensureDirectoryExists($this->tempMediaRoot);

        config([
            'filesystems.media_storage_path' => $this->tempMediaRoot,
            'filesystems.media_encryption_enabled' => true,
        ]);
    }

    protected function tearDown(): void
    {
        if (is_dir($this->tempMediaRoot)) {
            File::deleteDirectory($this->tempMediaRoot);
        }

        parent::tearDown();
    }

    public function test_duplicate_detection_is_scoped_to_the_current_map_only(): void
    {
        $owner = $this->createUser();
        $sourceMap = $this->createMap($owner, ['name' => 'Source Map']);
        $targetMap = $this->createMap($owner, ['name' => 'Target Map']);
        $upload = UploadedFile::fake()->image('scoped-duplicate.png', 24, 24);

        MediaFile::query()->create([
            'map_id' => $sourceMap->id,
            'original_name' => 'scoped-duplicate.png',
            'stored_name' => $sourceMap->map_uid . '/existing.png',
            'mime_type' => 'image/png',
            'size_bytes' => $upload->getSize(),
            'processed_at' => now(),
        ]);

        Sanctum::actingAs($owner);

        $response = $this->withHeader('Accept', 'application/json')->post(
            '/api/maps/' . $targetMap->id . '/media',
            [
                'files' => [$upload],
                'duplicate_options' => [
                    'filename' => true,
                    'size' => true,
                    'capture_date' => false,
                    'gps' => false,
                    'camera_make' => false,
                    'camera_model' => false,
                ],
            ]
        );

        $response
            ->assertCreated()
            ->assertJsonPath('created_count', 1)
            ->assertJsonPath('skipped_count', 0);

        $this->assertSame(1, MediaFile::query()->where('map_id', $targetMap->id)->count());
    }

    public function test_tokenized_media_endpoint_serves_decrypted_encrypted_content(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);
        $relativePath = $map->map_uid . '/secret.txt';
        $absolutePath = $this->absoluteMediaPath($relativePath);
        $plainContents = 'super-secret-media-payload';

        File::ensureDirectoryExists(dirname($absolutePath));
        file_put_contents($absolutePath, $plainContents);

        $processor = app(MediaProcessingService::class);
        $this->assertTrue($processor->encryptPathIfNeeded($absolutePath));

        $media = MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'secret.txt',
            'stored_name' => $relativePath,
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($plainContents),
            'processed_at' => now(),
        ]);

        $token = $owner->createToken('api-token', ['*'], now()->addDay())->plainTextToken;

        $response = $this->get('/api/maps/' . $map->id . '/media/' . $media->id . '/file-token?token=' . urlencode($token));

        $response->assertOk();
        $cacheControl = (string) $response->headers->get('Cache-Control', '');
        $this->assertStringContainsString('private', $cacheControl);
        $this->assertStringContainsString('no-store', $cacheControl);
        $this->assertStringContainsString('max-age=0', $cacheControl);
        $this->assertSame($plainContents, $response->getContent());
    }

    public function test_normalize_media_storage_paths_moves_legacy_files_into_map_uid_folders(): void
    {
        $map = $this->createMap($this->createUser());
        $legacyStoredName = 'legacy-photo.jpg';
        $legacyThumbName = 'legacy-photo-thumb.webp';
        $legacyStoredPath = $this->absoluteMediaPath($legacyStoredName);
        $legacyThumbPath = $this->tempMediaRoot . DIRECTORY_SEPARATOR . 'thumbnails' . DIRECTORY_SEPARATOR . $legacyThumbName;

        File::ensureDirectoryExists(dirname($legacyStoredPath));
        File::ensureDirectoryExists(dirname($legacyThumbPath));
        file_put_contents($legacyStoredPath, 'legacy-image-bytes');
        file_put_contents($legacyThumbPath, 'legacy-thumb-bytes');

        $media = MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'legacy-photo.jpg',
            'stored_name' => $legacyStoredName,
            'thumbnail_name' => $legacyThumbName,
            'mime_type' => 'image/jpeg',
            'size_bytes' => filesize($legacyStoredPath) ?: null,
            'processed_at' => now(),
        ]);

        $this->artisan('media:normalize-storage-paths', [
            '--map-id' => (string) $map->id,
        ])->assertExitCode(0);

        $media->refresh();

        $expectedStoredName = $map->map_uid . '/legacy-photo.jpg';
        $expectedThumbName = $map->map_uid . '/thumbnails/legacy-photo-thumb.webp';

        $this->assertSame($expectedStoredName, $media->stored_name);
        $this->assertSame($expectedThumbName, $media->thumbnail_name);
        $this->assertFileDoesNotExist($legacyStoredPath);
        $this->assertFileDoesNotExist($legacyThumbPath);
        $this->assertFileExists($this->absoluteMediaPath($expectedStoredName));
        $this->assertFileExists($this->absoluteMediaPath($expectedThumbName));
    }

    public function test_deleting_a_map_removes_associated_media_rows_and_files(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);
        $storedName = $map->map_uid . '/delete-me.txt';
        $thumbName = $map->map_uid . '/thumbnails/delete-me.webp';
        $storedPath = $this->absoluteMediaPath($storedName);
        $thumbPath = $this->absoluteMediaPath($thumbName);

        File::ensureDirectoryExists(dirname($storedPath));
        File::ensureDirectoryExists(dirname($thumbPath));
        file_put_contents($storedPath, 'delete me');
        file_put_contents($thumbPath, 'thumb');

        $media = MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'delete-me.txt',
            'stored_name' => $storedName,
            'thumbnail_name' => $thumbName,
            'mime_type' => 'text/plain',
            'size_bytes' => filesize($storedPath) ?: null,
            'processed_at' => now(),
        ]);

        Sanctum::actingAs($owner);

        $this->deleteJson('/api/maps/' . $map->id)->assertNoContent();

        $this->assertDatabaseMissing('memories_maps', ['id' => $map->id]);
        $this->assertDatabaseMissing('media_files', ['id' => $media->id]);
        $this->assertFileDoesNotExist($storedPath);
        $this->assertFileDoesNotExist($thumbPath);
    }

    public function test_deleting_media_removes_files_media_row_and_related_notes(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);
        $storedName = $map->map_uid . '/single-delete.txt';
        $thumbName = $map->map_uid . '/thumbnails/single-delete.webp';
        $storedPath = $this->absoluteMediaPath($storedName);
        $thumbPath = $this->absoluteMediaPath($thumbName);

        File::ensureDirectoryExists(dirname($storedPath));
        File::ensureDirectoryExists(dirname($thumbPath));
        file_put_contents($storedPath, 'single delete');
        file_put_contents($thumbPath, 'single thumb');

        $media = MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'single-delete.txt',
            'stored_name' => $storedName,
            'thumbnail_name' => $thumbName,
            'mime_type' => 'text/plain',
            'size_bytes' => filesize($storedPath) ?: null,
            'processed_at' => now(),
        ]);

        $note = MapNote::query()->create([
            'map_id' => $map->id,
            'media_id' => $media->id,
            'note_type' => 'media',
            'title' => 'Linked note',
            'body' => 'Should be removed with media.',
        ]);

        Sanctum::actingAs($owner);

        $this->deleteJson('/api/maps/' . $map->id . '/media/' . $media->id)->assertNoContent();

        $this->assertDatabaseMissing('media_files', ['id' => $media->id]);
        $this->assertDatabaseMissing('map_notes', ['id' => $note->id]);
        $this->assertFileDoesNotExist($storedPath);
        $this->assertFileDoesNotExist($thumbPath);
    }
    private function absoluteMediaPath(string $relativePath): string
    {
        $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($relativePath, '/\\'));

        return $this->tempMediaRoot . DIRECTORY_SEPARATOR . $normalized;
    }
}