<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MapGuest;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class GuestInvitationFeatureTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    public function test_guest_invites_are_unique_per_map_via_email_hash(): void
    {
        $owner = $this->createUser();
        $firstMap = $this->createMap($owner, ['name' => 'First Map']);
        $secondMap = $this->createMap($owner, ['name' => 'Second Map']);

        Sanctum::actingAs($owner);

        $firstInvite = $this->postJson('/api/maps/' . $firstMap->id . '/guests', [
            'email' => 'Shared.Guest@gmail.com',
        ]);

        $firstInvite
            ->assertCreated()
            ->assertJsonPath('email', 'shared.guest@gmail.com');

        $duplicateInvite = $this->postJson('/api/maps/' . $firstMap->id . '/guests', [
            'email' => 'shared.guest@gmail.com',
        ]);

        $duplicateInvite
            ->assertStatus(409)
            ->assertSee('This email already has access to this map.');

        $secondInvite = $this->postJson('/api/maps/' . $secondMap->id . '/guests', [
            'email' => 'shared.guest@gmail.com',
        ]);

        $secondInvite->assertCreated();

        $firstGuest = MapGuest::query()->where('map_id', $firstMap->id)->firstOrFail();
        $rawFirstGuest = DB::table('map_guests')->where('id', $firstGuest->id)->first();

        $this->assertNotSame('shared.guest@gmail.com', $rawFirstGuest->email);
        $this->assertSame(MapGuest::hashEmail('shared.guest@gmail.com'), $rawFirstGuest->email_hash);
        $this->assertSame(1, MapGuest::query()->where('map_id', $firstMap->id)->count());
        $this->assertSame(1, MapGuest::query()->where('map_id', $secondMap->id)->count());
    }

    public function test_guest_login_uses_email_hash_lookup_for_encrypted_email_values(): void
    {
        $map = $this->createMap($this->createUser());

        $guest = MapGuest::query()->create([
            'map_id' => $map->id,
            'email' => 'guest.login@gmail.com',
            'email_hash' => MapGuest::hashEmail('guest.login@gmail.com'),
            'password' => Hash::make('StrongPassword123!'),
            'access_token' => hash('sha256', 'plain-share-token'),
            'invited_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $rawGuest = DB::table('map_guests')->where('id', $guest->id)->first();
        $this->assertNotSame('guest.login@gmail.com', $rawGuest->email);

        $response = $this->postJson('/api/auth/guest-login', [
            'email' => 'GUEST.LOGIN@gmail.com',
            'password' => 'StrongPassword123!',
            'map_id' => $map->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('map_id', $map->id)
            ->assertJsonPath('access_token', $guest->access_token);

        $this->assertNotNull($guest->fresh()->last_accessed_at);
    }
}