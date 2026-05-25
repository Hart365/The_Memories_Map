<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MapNote;
use App\Models\MediaFile;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class WorkstreamBApiQualityFeatureTest extends TestCase
{
    use DatabaseTransactions;

    public function test_maps_index_supports_cursor_contract_when_requested(): void
    {
        $owner = $this->createUser();
        $this->createMap($owner, ['name' => 'Map A']);
        $this->createMap($owner, ['name' => 'Map B']);

        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/maps?per_page=1&sort=updated_at_desc');
        $response->assertOk();
        $response->assertJsonStructure([
            'data',
            'meta' => ['per_page', 'next_cursor', 'prev_cursor', 'has_more'],
        ]);
        $response->assertJsonPath('meta.per_page', 1);
    }

    public function test_media_index_returns_cursor_meta_and_respects_filters(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);

        MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'alpha.jpg',
            'stored_name' => $map->map_uid . '/alpha.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 120,
            'captured_at' => now()->subDay(),
            'processed_at' => now(),
            'processing_status' => MediaFile::PROCESSING_COMPLETED,
        ]);

        MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'beta.jpg',
            'stored_name' => $map->map_uid . '/beta.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 240,
            'processed_at' => now(),
            'processing_status' => MediaFile::PROCESSING_COMPLETED,
        ]);

        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/maps/' . $map->id . '/media?per_page=1&sort=size_desc');
        $response->assertOk();
        $response->assertJsonStructure([
            'data',
            'meta' => ['per_page', 'next_cursor', 'prev_cursor', 'has_more'],
        ]);
        $response->assertJsonPath('meta.per_page', 1);
    }

    public function test_notes_index_supports_cursor_and_type_filters(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);

        MapNote::query()->create([
            'map_id' => $map->id,
            'note_type' => 'map',
            'title' => 'Travel plan',
            'body' => 'Paris highlights',
        ]);

        MapNote::query()->create([
            'map_id' => $map->id,
            'note_type' => 'day',
            'title' => 'Daily log',
            'body' => 'Museum day',
        ]);

        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/maps/' . $map->id . '/notes?per_page=1&note_type=map');
        $response->assertOk();
        $response->assertJsonStructure([
            'data',
            'meta' => ['per_page', 'next_cursor', 'prev_cursor', 'has_more'],
        ]);
        $this->assertCount(1, $response->json('data'));
    }
}
