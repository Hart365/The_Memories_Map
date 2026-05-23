<?php

namespace App\Http\Middleware;

use App\Services\AdminSessionService;
use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function __construct(private readonly AdminSessionService $adminSessions) {}

    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-Admin-Token');

        if (! $this->adminSessions->isValidToken($token)) {
            return response()->json(['message' => 'Unauthorized admin request.'], 401);
        }

        return $next($request);
    }
}
