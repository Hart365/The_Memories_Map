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
use App\Services\TimezoneService;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
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
        ]);

        $token = $user->createToken('api-token', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'user'  => $user->only('id', 'name', 'email', 'default_timezone'),
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
            'user'  => $user->only('id', 'name', 'email', 'default_timezone'),
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

        $guest = MapGuest::where('email', $request->email)
            ->where('map_id', $request->map_id)
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
}
