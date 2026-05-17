<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogGeocodingRequests
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        \Log::info('>>> GEOCODING MIDDLEWARE: Request intercepted', [
            'timestamp' => now()->toIso8601String(),
            'method' => $request->method(),
            'full_url' => $request->fullUrl(),
            'path' => $request->path(),
            'route_name' => $request->route()?->getName(),
            'route_uri' => $request->route()?->uri(),
            'query_string' => $request->getQueryString(),
            'all_input' => $request->all(),
            'headers' => [
                'accept' => $request->header('Accept'),
                'content-type' => $request->header('Content-Type'),
                'authorization' => $request->header('Authorization') ? 'Bearer ***' : null,
            ],
            'user_authenticated' => $request->user() ? true : false,
            'user_id' => $request->user()?->id,
        ]);

        $response = $next($request);

        \Log::info('<<< GEOCODING MIDDLEWARE: Response generated', [
            'status' => $response->getStatusCode(),
            'content_type' => $response->headers->get('Content-Type'),
            'content_length' => strlen($response->getContent()),
            'content_preview' => substr($response->getContent(), 0, 200),
        ]);

        return $response;
    }
}
