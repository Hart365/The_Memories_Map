<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SiteSettingsService;
use Illuminate\Http\JsonResponse;

class PublicSettingsController extends Controller
{
    public function __construct(private readonly SiteSettingsService $siteSettings) {}

    public function show(): JsonResponse
    {
        return response()->json($this->siteSettings->getPublicSettingsPayload());
    }
}
