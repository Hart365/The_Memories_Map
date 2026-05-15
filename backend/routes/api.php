<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MapController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\ThemeController;
use App\Http\Controllers\Api\ProfileController;
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
});

// ── Authenticated user routes ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Profile
    Route::get('/profile',  [ProfileController::class, 'show']);
    Route::put('/profile',  [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword']);
    Route::delete('/profile', [ProfileController::class, 'destroy']);

    // Colour themes (read-only for all, managed by admin seeder)
    Route::get('/themes', [ThemeController::class, 'index']);

    // Memories Maps (owner)
    Route::apiResource('maps', MapController::class);
    Route::put('/maps/{map}/theme', [MapController::class, 'updateTheme']);

    // Media files
    Route::get('/maps/{map}/media',             [MediaController::class, 'index']);
    Route::post('/maps/{map}/media',            [MediaController::class, 'store']);
    Route::get('/maps/{map}/media/{media}',     [MediaController::class, 'show']);
    Route::put('/maps/{map}/media/{media}',     [MediaController::class, 'update']);
    Route::delete('/maps/{map}/media/{media}',  [MediaController::class, 'destroy']);
    Route::get('/maps/{map}/media/{media}/file', [MediaController::class, 'serveFile']);
    Route::get('/maps/{map}/media/{media}/thumb', [MediaController::class, 'serveThumbnail']);

    // Notes (day / location / media / map-level)
    Route::apiResource('maps.notes', NoteController::class)->shallow();

    // Guest access management
    Route::get('/maps/{map}/guests',              [GuestController::class, 'index']);
    Route::post('/maps/{map}/guests',             [GuestController::class, 'store']);
    Route::delete('/maps/{map}/guests/{guest}',   [GuestController::class, 'destroy']);
    Route::post('/maps/{map}/guests/{guest}/reset-password', [GuestController::class, 'resetPassword']);
});

// ── Guest (shared-link) routes ────────────────────────────────────────────
Route::middleware('guest.access')->prefix('shared')->group(function () {
    Route::get('/maps/{map}',                          [MapController::class, 'showShared']);
    Route::get('/maps/{map}/media',                    [MediaController::class, 'indexShared']);
    Route::get('/maps/{map}/media/{media}/thumb',      [MediaController::class, 'serveThumbnail']);
    Route::get('/maps/{map}/notes',                    [NoteController::class, 'indexShared']);
});
