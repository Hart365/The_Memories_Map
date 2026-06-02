<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SPA entrypoint routes
|--------------------------------------------------------------------------
| Serve the compiled frontend for all non-API routes so BrowserRouter
| deep links (for example /maps/:id/map and /maps/:id/gallery) keep working
| on refresh and direct navigation.
*/

$serveFrontend = function () {
    $candidates = [
        public_path('index.html'),
    ];

    $scriptDir = isset($_SERVER['SCRIPT_FILENAME']) ? dirname((string) $_SERVER['SCRIPT_FILENAME']) : null;
    if (is_string($scriptDir) && $scriptDir !== '') {
        $candidates[] = $scriptDir . DIRECTORY_SEPARATOR . 'index.html';
    }

    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;
    if (is_string($documentRoot) && $documentRoot !== '') {
        $candidates[] = rtrim($documentRoot, '/\\') . DIRECTORY_SEPARATOR . 'index.html';
    }

    foreach (array_unique($candidates) as $indexPath) {
        if (is_file($indexPath)) {
            return response()->file($indexPath);
        }
    }

    return response()->json([
        'message' => 'Frontend build not found. Ensure index.html exists in backend/public or public_html.',
    ], 503);
};

Route::get('/', $serveFrontend);
Route::get('/login', $serveFrontend)->name('login');

Route::fallback(function () use ($serveFrontend) {
    if (request()->is('api/*')) {
        abort(404);
    }

    return $serveFrontend();
});
