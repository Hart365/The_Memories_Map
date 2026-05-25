<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ApiRequestMetrics
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->is('api/*')) {
            return $next($request);
        }

        $start = microtime(true);
        $response = $next($request);
        $durationMs = (int) round((microtime(true) - $start) * 1000);

        Log::info('api_request_metric', [
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => $durationMs,
            'user_id' => $request->user()?->id,
            'request_id' => (string) $request->headers->get('X-Request-ID', ''),
            'ip' => $request->ip(),
        ]);

        return $response;
    }
}
