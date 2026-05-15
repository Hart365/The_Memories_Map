<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapGuest;
use App\Models\MemoriesMap;
use App\Notifications\GuestInviteNotification;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class GuestController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $guests = $map->guests()
            ->select('id', 'email', 'invited_at', 'expires_at', 'last_accessed_at')
            ->orderByDesc('invited_at')
            ->get();

        return response()->json($guests);
    }

    public function store(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $validated = $request->validate([
            'email'      => ['required', 'email:rfc,dns', 'max:255'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        // Prevent duplicate active guests for the same map
        abort_if(
            $map->guests()->where('email', $validated['email'])->exists(),
            409,
            'This email already has access to this map.'
        );

        $plainPassword = Str::random(12);
        $accessToken   = MapGuest::generateAccessToken();

        $expiresAt = $validated['expires_at']
            ?? now()->addHours((int) config('app.guest_token_expiry_hours', 168));

        $guest = $map->guests()->create([
            'email'        => $validated['email'],
            'password'     => Hash::make($plainPassword),
            'access_token' => $accessToken,
            'invited_at'   => now(),
            'expires_at'   => $expiresAt,
        ]);

        // Send invite email with the plain-text password (one-time)
        $guest->notify(new GuestInviteNotification($map, $plainPassword));

        return response()->json([
            'id'         => $guest->id,
            'email'      => $guest->email,
            'invited_at' => $guest->invited_at,
            'expires_at' => $guest->expires_at,
        ], 201);
    }

    public function destroy(Request $request, MemoriesMap $map, MapGuest $guest): JsonResponse
    {
        $this->authorize('update', $map);
        abort_if($guest->map_id !== $map->id, 404);

        $guest->delete();

        return response()->json(null, 204);
    }

    public function resetPassword(Request $request, MemoriesMap $map, MapGuest $guest): JsonResponse
    {
        $this->authorize('update', $map);
        abort_if($guest->map_id !== $map->id, 404);

        $newPlain = Str::random(12);
        $guest->update(['password' => Hash::make($newPlain)]);

        $guest->notify(new GuestInviteNotification($map, $newPlain, isReset: true));

        return response()->json(['message' => 'Guest password reset and notification sent.']);
    }
}
