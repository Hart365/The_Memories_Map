<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminSessionService;
use App\Services\SiteSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAuthController extends Controller
{
    public function __construct(
        private readonly SiteSettingsService $siteSettings,
        private readonly AdminSessionService $adminSessions
    ) {}

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $ok = $this->siteSettings->verifyAdminCredentials(
            $validated['username'],
            $validated['password']
        );

        if (! $ok) {
            return response()->json(['message' => 'Invalid admin credentials.'], 401);
        }

        $token = $this->adminSessions->createToken();

        return response()->json([
            'admin_token' => $token,
            'settings' => $this->siteSettings->getAdminSettingsPayload(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->adminSessions->invalidateToken($request->header('X-Admin-Token'));

        return response()->json(['message' => 'Admin logged out.']);
    }
}
