<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use App\Models\MapGuest;
use App\Services\SiteSettingsService;
use App\Services\TimezoneService;

class AuthController extends Controller
{
    public function __construct(private readonly SiteSettingsService $siteSettings) {}

    public function register(Request $request): JsonResponse
    {
        if (! $this->siteSettings->isRegistrationAllowed()) {
            return response()->json([
                'message' => 'New user registration is currently disabled by the site administrator.',
            ], 403);
        }

        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email:rfc,dns', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $user = User::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'default_timezone' => TimezoneService::DEFAULT_TIMEZONE,
            'date_format' => 'YYYY-MM-DD',
        ]);

        $token = $user->createToken('api-token', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'user'  => $user->only('id', 'name', 'email', 'default_timezone', 'date_format'),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        /** @var User $user */
        $user = Auth::user();
        $user->tokens()->where('name', 'api-token')->delete();
        $token = $user->createToken('api-token', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'user'  => $user->only('id', 'name', 'email', 'default_timezone', 'date_format'),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * Guest login using email + password issued by a map owner.
     */
    public function guestLogin(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
            'map_id'   => ['required', 'integer'],
        ]);

        $normalizedEmail = strtolower(trim((string) $request->email));

        $guest = MapGuest::where('map_id', $request->map_id)
            ->where(function ($query) use ($normalizedEmail) {
                $query->where('email_hash', MapGuest::hashEmail($normalizedEmail))
                    ->orWhere('email', $normalizedEmail);
            })
            ->first();

        if (! $guest || ! Hash::check($request->password, $guest->password)) {
            return response()->json(['message' => 'Invalid guest credentials.'], 401);
        }

        if ($guest->isExpired()) {
            return response()->json(['message' => 'Guest access has expired.'], 403);
        }

        $guest->update(['last_accessed_at' => now()]);

        return response()->json([
            'access_token' => $guest->access_token,
            'map_id'       => $guest->map_id,
            'expires_at'   => $guest->expires_at,
        ]);
    }

    /**
     * Resolve a shared-map invitation using the secret link token plus the invited email.
     */
    public function guestAccess(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $guest = MapGuest::findByAccessToken($token);

        if (! $guest || ! hash_equals(strtolower($guest->email), strtolower($validated['email']))) {
            return response()->json(['message' => 'Invalid invitation link or email address.'], 401);
        }

        if ($guest->isExpired()) {
            return response()->json(['message' => 'This shared link has expired.'], 403);
        }

        $guest->update(['last_accessed_at' => now()]);

        return response()->json([
            'access_token' => $token,
            'map_id' => $guest->map_id,
            'expires_at' => $guest->expires_at,
            'email' => $guest->email,
        ]);
    }
}
