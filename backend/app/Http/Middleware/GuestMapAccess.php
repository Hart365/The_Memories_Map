<?php

namespace App\Http\Middleware;

use App\Models\MapGuest;
use App\Models\MemoriesMap;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validates the guest access token passed in the Authorization header
 * for shared map routes.  Injects a 'guest' binding into the request.
 *
 * Header:  Authorization: Bearer <access_token>
 */
class GuestMapAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken() ?: (string) $request->query('token', '');

        if (! $token) {
            return response()->json(['message' => 'Guest access token required.'], 401);
        }

        $guest = MapGuest::findByAccessToken($token);

        if (! $guest) {
            return response()->json(['message' => 'Invalid guest token.'], 401);
        }

        if ($guest->isExpired()) {
            return response()->json(['message' => 'Guest access has expired.'], 403);
        }

        // Ensure the token matches the map requested in the route
        $mapId = $request->route('map') instanceof MemoriesMap
            ? $request->route('map')->id
            : (int) $request->route('map');

        if ($guest->map_id !== $mapId) {
            return response()->json(['message' => 'Token does not grant access to this map.'], 403);
        }

        $guest->update(['last_accessed_at' => now()]);
        $request->attributes->set('guest', $guest);

        return $next($request);
    }
}
