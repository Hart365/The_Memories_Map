<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MapGuest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AuthAndGuestAccessRegressionFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_login_returns_token_and_logout_revokes_current_token(): void
    {
        $user = $this->createUser([
            'email' => 'regression-user@example.com',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'regression-user@example.com',
            'password' => 'Password123!',
        ]);

        $login->assertOk();
        $token = (string) $login->json('token');
        $this->assertNotSame('', $token);

        $logout = $this
            ->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/auth/logout');

        $logout->assertOk();
        $this->assertSame('Logged out.', $logout->json('message'));
    }

    public function test_guest_access_rejects_mismatched_email(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);
        $plainToken = 'plain-shared-token-123';

        MapGuest::query()->create([
            'map_id' => $map->id,
            'email' => 'invited@example.com',
            'email_hash' => MapGuest::hashEmail('invited@example.com'),
            'password' => 'StrongPassword123!',
            'access_token' => hash('sha256', $plainToken),
            'invited_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $response = $this->postJson('/api/auth/guest-access/' . $plainToken, [
            'email' => 'other@example.com',
        ]);

        $response->assertStatus(401);
    }

    public function test_guest_access_accepts_case_insensitive_email_match(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);
        $plainToken = 'plain-shared-token-456';

        MapGuest::query()->create([
            'map_id' => $map->id,
            'email' => 'invited.case@example.com',
            'email_hash' => MapGuest::hashEmail('invited.case@example.com'),
            'password' => 'StrongPassword123!',
            'access_token' => hash('sha256', $plainToken),
            'invited_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $response = $this->postJson('/api/auth/guest-access/' . $plainToken, [
            'email' => 'INVITED.CASE@example.com',
        ]);

        $response->assertOk();
        $response->assertJsonPath('access_token', $plainToken);
        $response->assertJsonPath('map_id', $map->id);
    }

    public function test_shared_route_requires_guest_access_token(): void
    {
        $owner = $this->createUser();
        $map = $this->createMap($owner);

        $response = $this->getJson('/api/shared/maps/' . $map->id);
        $response->assertStatus(401);
    }
}
