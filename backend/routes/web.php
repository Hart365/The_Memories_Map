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
    $indexPath = public_path('index.html');

    if (is_file($indexPath)) {
        return response()->file($indexPath);
    }

    return response()->json([
        'message' => 'Frontend build not found. Run the frontend build to generate public/index.html.',
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
