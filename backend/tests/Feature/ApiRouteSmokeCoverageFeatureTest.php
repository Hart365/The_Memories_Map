<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MapGuest;
use App\Models\MapNote;
use App\Models\MediaFile;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ApiRouteSmokeCoverageFeatureTest extends TestCase
{
    use DatabaseTransactions;

    public function test_public_and_admin_routes_have_stable_non_500_behavior(): void
    {
        $response = $this->getJson('/api/public/settings');
        $this->assertStatusIn($response, [200]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Smoke User',
            'email' => 'invalid-email',
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);
        $this->assertStatusIn($response, [403, 422]);

        $response = $this->postJson('/api/register', [
            'name' => 'Legacy User',
            'email' => 'legacy-invalid',
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);
        $this->assertStatusIn($response, [403, 422]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'not-found@example.com',
            'password' => 'wrong-password',
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/login', [
            'email' => 'not-found@example.com',
            'password' => 'wrong-password',
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/auth/guest-login', [
            'email' => 'guest@example.com',
            'password' => 'wrong-password',
            'map_id' => 999999,
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/guest-login', [
            'email' => 'guest@example.com',
            'password' => 'wrong-password',
            'map_id' => 999999,
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/auth/guest-access/invalid-token', [
            'email' => 'guest@example.com',
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/guest-access/invalid-token', [
            'email' => 'guest@example.com',
        ]);
        $this->assertStatusIn($response, [401, 422]);

        $response = $this->postJson('/api/admin/login', [
            'username' => 'invalid-admin',
            'password' => 'invalid-password',
        ]);
        $this->assertStatusIn($response, [401, 422]);

        foreach ([
            ['method' => 'getJson', 'uri' => '/api/admin/settings'],
            ['method' => 'putJson', 'uri' => '/api/admin/settings', 'payload' => []],
            ['method' => 'postJson', 'uri' => '/api/admin/settings/test-mail', 'payload' => []],
            ['method' => 'postJson', 'uri' => '/api/admin/settings/test-connection', 'payload' => []],
            ['method' => 'postJson', 'uri' => '/api/admin/settings/reset-mail', 'payload' => []],
            ['method' => 'postJson', 'uri' => '/api/admin/settings/purge-database', 'payload' => []],
            ['method' => 'getJson', 'uri' => '/api/admin/queue/health'],
            ['method' => 'postJson', 'uri' => '/api/admin/queue/replay-failed', 'payload' => []],
        ] as $call) {
            $method = $call['method'];
            $payload = $call['payload'] ?? [];
            /** @var TestResponse $response */
            $response = $this->{$method}($call['uri'], $payload);
            $this->assertStatusIn($response, [401]);
        }
    }

    public function test_authenticated_owner_and_guest_routes_have_stable_non_500_behavior(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);

        $media = MediaFile::query()->create([
            'map_id' => $map->id,
            'original_name' => 'smoke.jpg',
            'stored_name' => $map->map_uid . '/smoke.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 123,
            'processed_at' => now(),
            'processing_status' => MediaFile::PROCESSING_COMPLETED,
        ]);

        $note = MapNote::query()->create([
            'map_id' => $map->id,
            'note_type' => 'map',
            'title' => 'Smoke Note',
            'body' => 'Smoke body',
        ]);

        $plainGuestToken = 'guest-smoke-token-123456';
        $guest = MapGuest::query()->create([
            'map_id' => $map->id,
            'email' => 'guest.smoke@example.com',
            'email_hash' => MapGuest::hashEmail('guest.smoke@example.com'),
            'password' => 'StrongPassword123!',
            'access_token' => hash('sha256', $plainGuestToken),
            'invited_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        Sanctum::actingAs($owner);

        foreach ([
            ['method' => 'getJson', 'uri' => '/api/profile', 'expected' => [200]],
            ['method' => 'getJson', 'uri' => '/api/profile/timezones', 'expected' => [200]],
            ['method' => 'putJson', 'uri' => '/api/profile', 'payload' => ['name' => 'Updated Smoke User'], 'expected' => [200, 422]],
            ['method' => 'putJson', 'uri' => '/api/profile/password', 'payload' => ['current_password' => 'wrong', 'password' => 'NewStrongPassword123!', 'password_confirmation' => 'NewStrongPassword123!'], 'expected' => [422]],
            ['method' => 'getJson', 'uri' => '/api/themes', 'expected' => [200]],
            ['method' => 'getJson', 'uri' => '/api/geocode', 'expected' => [400, 422]],

            ['method' => 'getJson', 'uri' => '/api/maps', 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps', 'payload' => ['name' => 'Smoke Created Map', 'description' => 'desc'], 'expected' => [201, 422]],
            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id, 'expected' => [200]],
            ['method' => 'putJson', 'uri' => '/api/maps/' . $map->id, 'payload' => ['name' => 'Renamed Smoke Map'], 'expected' => [200, 422]],
            ['method' => 'putJson', 'uri' => '/api/maps/' . $map->id . '/theme', 'payload' => ['color_theme_id' => 999999], 'expected' => [200, 422]],

            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/media', 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/media', 'payload' => [], 'expected' => [422]],
            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id, 'expected' => [200]],
            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id . '/processing-status', 'expected' => [200]],
            ['method' => 'putJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id, 'payload' => ['user_caption' => 'Updated caption'], 'expected' => [200, 422]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id . '/rescan-location', 'payload' => [], 'expected' => [200, 202, 422]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/media/rescan-locations', 'payload' => [], 'expected' => [200, 202]],
            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id . '/file', 'expected' => [404]],
            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/media/' . $media->id . '/thumb', 'expected' => [404]],

            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/notes', 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/notes', 'payload' => ['note_type' => 'map', 'title' => 'Created note', 'body' => 'created body'], 'expected' => [201, 422]],
            ['method' => 'getJson', 'uri' => '/api/notes/' . $note->id, 'expected' => [200]],
            ['method' => 'putJson', 'uri' => '/api/notes/' . $note->id, 'payload' => ['title' => 'Updated note'], 'expected' => [200, 422]],

            ['method' => 'getJson', 'uri' => '/api/maps/' . $map->id . '/guests', 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/guests', 'payload' => ['email' => 'guest.added@example.com'], 'expected' => [201, 409, 422]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/guests/' . $guest->id . '/rotate-link', 'payload' => [], 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/guests/' . $guest->id . '/resend-invite', 'payload' => [], 'expected' => [200]],
            ['method' => 'postJson', 'uri' => '/api/maps/' . $map->id . '/guests/' . $guest->id . '/reset-password', 'payload' => [], 'expected' => [200]],
        ] as $call) {
            $method = $call['method'];
            $payload = $call['payload'] ?? [];
            /** @var TestResponse $response */
            $response = $this->{$method}($call['uri'], $payload);
            $this->assertStatusIn($response, $call['expected']);
        }

        $tokenResponse = $owner->createToken('api-token')->plainTextToken;
        $fileTokenResponse = $this->get('/api/maps/' . $map->id . '/media/' . $media->id . '/file-token?token=' . urlencode($tokenResponse));
        $this->assertStatusIn($fileTokenResponse, [404]);

        $thumbTokenResponse = $this->get('/api/maps/' . $map->id . '/media/' . $media->id . '/thumb-token?token=' . urlencode($tokenResponse));
        $this->assertStatusIn($thumbTokenResponse, [404]);

        $sharedMapResponse = $this->getJson('/api/shared/maps/' . $map->id . '?token=' . urlencode($plainGuestToken));
        $this->assertStatusIn($sharedMapResponse, [200, 401]);

        $sharedMediaResponse = $this->getJson('/api/shared/maps/' . $map->id . '/media?token=' . urlencode($plainGuestToken));
        $this->assertStatusIn($sharedMediaResponse, [200, 401]);

        $sharedMediaFileResponse = $this->get('/api/shared/maps/' . $map->id . '/media/' . $media->id . '/file?token=' . urlencode($plainGuestToken));
        $this->assertStatusIn($sharedMediaFileResponse, [401, 404]);

        $sharedMediaThumbResponse = $this->get('/api/shared/maps/' . $map->id . '/media/' . $media->id . '/thumb?token=' . urlencode($plainGuestToken));
        $this->assertStatusIn($sharedMediaThumbResponse, [401, 404]);

        $sharedNotesResponse = $this->getJson('/api/shared/maps/' . $map->id . '/notes?token=' . urlencode($plainGuestToken));
        $this->assertStatusIn($sharedNotesResponse, [200, 401]);

        $deleteGuestResponse = $this->deleteJson('/api/maps/' . $map->id . '/guests/' . $guest->id);
        $this->assertStatusIn($deleteGuestResponse, [204]);

        $deleteNoteResponse = $this->deleteJson('/api/notes/' . $note->id);
        $this->assertStatusIn($deleteNoteResponse, [204]);

        $deleteMediaResponse = $this->deleteJson('/api/maps/' . $map->id . '/media/' . $media->id);
        $this->assertStatusIn($deleteMediaResponse, [204]);

        $deleteMapResponse = $this->deleteJson('/api/maps/' . $map->id);
        $this->assertStatusIn($deleteMapResponse, [204]);
    }

    /**
     * @param array<int> $statuses
     */
    private function assertStatusIn(TestResponse $response, array $statuses): void
    {
        $actual = $response->getStatusCode();

        $this->assertTrue(
            in_array($actual, $statuses, true),
            'Unexpected status ' . $actual . '. Expected one of: ' . implode(', ', $statuses)
        );
    }
}
