<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapGuest;
use App\Models\MemoriesMap;
use App\Notifications\GuestInviteNotification;
use App\Services\MailSettingsService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GuestController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly MailSettingsService $mailSettings) {}

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

        $normalizedEmail = strtolower(trim($validated['email']));

        // Include soft-deleted rows because DB unique index is on (map_id, email).
        $existingGuest = MapGuest::withTrashed()
            ->where('map_id', $map->id)
            ->where('email', $normalizedEmail)
            ->first();

        abort_if(
            $existingGuest && ! $existingGuest->trashed(),
            409,
            'This email already has access to this map.'
        );

        $plainAccessToken = MapGuest::generateAccessToken();

        $expiresAt = $validated['expires_at']
            ?? now()->addHours((int) config('app.guest_token_expiry_hours', 168));

        if ($existingGuest && $existingGuest->trashed()) {
            $existingGuest->restore();
            $existingGuest->update([
                'email' => $normalizedEmail,
                'password' => Hash::make(Str::random(32)),
                'access_token' => hash('sha256', $plainAccessToken),
                'invited_at' => now(),
                'expires_at' => $expiresAt,
                'last_accessed_at' => null,
            ]);
            $guest = $existingGuest->fresh();
        } else {
            $guest = $map->guests()->create([
                'email'        => $normalizedEmail,
                'password'     => Hash::make(Str::random(32)),
                'access_token' => hash('sha256', $plainAccessToken),
                'invited_at'   => now(),
                'expires_at'   => $expiresAt,
            ]);
        }

        $shareUrl = $this->buildShareUrl($plainAccessToken);

        $mailFailed = false;
        try {
            $this->mailSettings->applyConfiguredMailer();
            $guest->notify(new GuestInviteNotification($map, $shareUrl, $expiresAt));
        } catch (\Throwable $e) {
            $mailFailed = true;
            Log::warning('Share invite email failed; returning generated share link anyway.', [
                'map_id' => $map->id,
                'guest_id' => $guest->id,
                'guest_email' => $guest->email,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'id'         => $guest->id,
            'email'      => $guest->email,
            'invited_at' => $guest->invited_at,
            'expires_at' => $guest->expires_at,
            'share_url'  => $shareUrl,
            'mail_failed' => $mailFailed,
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
        // Backward-compatible alias: this endpoint now behaves like resend-invite.
        return $this->resendInvite($request, $map, $guest);
    }

    public function rotateLink(Request $request, MemoriesMap $map, MapGuest $guest): JsonResponse
    {
        $this->authorize('update', $map);
        abort_if($guest->map_id !== $map->id, 404);

        [$shareUrl, $expiresAt] = $this->rotateGuestShareLink($guest);

        return response()->json([
            'message' => 'Guest share link rotated.',
            'share_url' => $shareUrl,
            'expires_at' => $expiresAt,
        ]);
    }

    public function resendInvite(Request $request, MemoriesMap $map, MapGuest $guest): JsonResponse
    {
        $this->authorize('update', $map);
        abort_if($guest->map_id !== $map->id, 404);

        [$shareUrl, $expiresAt] = $this->rotateGuestShareLink($guest);
        $mailFailed = false;
        try {
            $this->mailSettings->applyConfiguredMailer();
            $guest->notify(new GuestInviteNotification($map, $shareUrl, $expiresAt, isReset: true));
        } catch (\Throwable $e) {
            $mailFailed = true;
            Log::warning('Resend share invite email failed; returning generated share link anyway.', [
                'map_id' => $map->id,
                'guest_id' => $guest->id,
                'guest_email' => $guest->email,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'message' => $mailFailed
                ? 'Share link rotated, but invite email could not be sent. Copy the link manually.'
                : 'Guest invitation email resent with a new secure link.',
            'share_url' => $shareUrl,
            'expires_at' => $expiresAt,
            'mail_failed' => $mailFailed,
        ]);
    }

    private function buildShareUrl(string $plainAccessToken): string
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');

        return $frontendUrl . '/shared/' . $plainAccessToken;
    }

    private function rotateGuestShareLink(MapGuest $guest): array
    {
        $plainAccessToken = MapGuest::generateAccessToken();
        $expiresAt = now()->addHours((int) config('app.guest_token_expiry_hours', 168));

        $guest->update([
            'password' => Hash::make(Str::random(32)),
            'access_token' => hash('sha256', $plainAccessToken),
            'expires_at' => $expiresAt,
        ]);

        return [$this->buildShareUrl($plainAccessToken), $expiresAt];
    }
}
