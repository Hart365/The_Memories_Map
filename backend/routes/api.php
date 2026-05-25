<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MapController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\ThemeController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\GeocodingController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AdminQueueController;
use App\Http\Controllers\Api\PublicSettingsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes – Memories Map
|--------------------------------------------------------------------------
*/

// ── Public auth routes ────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
    Route::post('/guest-login', [AuthController::class, 'guestLogin']);
    Route::post('/guest-access/{token}', [AuthController::class, 'guestAccess']);
});

// Legacy auth aliases kept for older frontend bundles that still call /api/* directly.
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/guest-login', [AuthController::class, 'guestLogin']);
Route::post('/guest-access/{token}', [AuthController::class, 'guestAccess']);
Route::get('/public/settings', [PublicSettingsController::class, 'show']);

Route::prefix('admin')->group(function () {
    Route::post('/login', [AdminAuthController::class, 'login']);

    Route::middleware('admin.auth')->group(function () {
        Route::post('/logout', [AdminAuthController::class, 'logout']);
        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/test-mail', [AdminSettingsController::class, 'sendTest']);
        Route::post('/settings/test-connection', [AdminSettingsController::class, 'testConnection']);
        Route::post('/settings/reset-mail', [AdminSettingsController::class, 'resetMailToEnv']);
        Route::get('/queue/health', [AdminQueueController::class, 'health']);
        Route::post('/queue/replay-failed', [AdminQueueController::class, 'replayFailed']);
    });
});

// Token-authenticated media routes for <img>/<video> tags
Route::get('/maps/{map}/media/{media}/file-token', [MediaController::class, 'serveFileToken']);
Route::get('/maps/{map}/media/{media}/thumb-token', [MediaController::class, 'serveThumbnailToken']);

// ── Authenticated user routes ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Profile
    Route::get('/profile',  [ProfileController::class, 'show']);
    Route::get('/profile/timezones',  [ProfileController::class, 'timezones']);
    Route::put('/profile',  [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword']);
    Route::delete('/profile', [ProfileController::class, 'destroy']);

    // Colour themes (read-only for all, managed by admin seeder)
    Route::get('/themes', [ThemeController::class, 'index']);

    // Geocoding service (forward & reverse geocoding)
    Route::get('/geocode', [GeocodingController::class, 'geocode'])
        ->middleware(\App\Http\Middleware\LogGeocodingRequests::class);

    // Memories Maps (owner)
    Route::apiResource('maps', MapController::class);
    Route::put('/maps/{map}/theme', [MapController::class, 'updateTheme']);

    // Media files
    Route::get('/maps/{map}/media',             [MediaController::class, 'index']);
    Route::post('/maps/{map}/media',            [MediaController::class, 'store']);
    Route::get('/maps/{map}/media/{media}',     [MediaController::class, 'show']);
    Route::get('/maps/{map}/media/{media}/processing-status', [MediaController::class, 'processingStatus']);
    Route::put('/maps/{map}/media/{media}',     [MediaController::class, 'update']);
    Route::delete('/maps/{map}/media/{media}',  [MediaController::class, 'destroy']);
    Route::post('/maps/{map}/media/{media}/rescan-location', [MediaController::class, 'rescanLocation']);
    Route::post('/maps/{map}/media/rescan-locations', [MediaController::class, 'rescanMapLocations']);
    Route::get('/maps/{map}/media/{media}/file', [MediaController::class, 'serveFile']);
    Route::get('/maps/{map}/media/{media}/thumb', [MediaController::class, 'serveThumbnail']);

    // Notes (day / location / media / map-level)
    Route::apiResource('maps.notes', NoteController::class)->shallow();

    // Guest access management
    Route::get('/maps/{map}/guests',              [GuestController::class, 'index']);
    Route::post('/maps/{map}/guests',             [GuestController::class, 'store']);
    Route::delete('/maps/{map}/guests/{guest}',   [GuestController::class, 'destroy']);
    Route::post('/maps/{map}/guests/{guest}/rotate-link', [GuestController::class, 'rotateLink']);
    Route::post('/maps/{map}/guests/{guest}/resend-invite', [GuestController::class, 'resendInvite']);
    Route::post('/maps/{map}/guests/{guest}/reset-password', [GuestController::class, 'resetPassword']);
});

// ── Guest (shared-link) routes ────────────────────────────────────────────
Route::middleware('guest.access')->prefix('shared')->group(function () {
    Route::get('/maps/{map}',                          [MapController::class, 'showShared']);
    Route::get('/maps/{map}/media',                    [MediaController::class, 'indexShared']);
    Route::get('/maps/{map}/media/{media}/file',       [MediaController::class, 'serveFile']);
    Route::get('/maps/{map}/media/{media}/thumb',      [MediaController::class, 'serveThumbnail']);
    Route::get('/maps/{map}/notes',                    [NoteController::class, 'indexShared']);
});
