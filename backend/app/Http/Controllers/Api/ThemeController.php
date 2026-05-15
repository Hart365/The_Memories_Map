<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ColorTheme;
use Illuminate\Http\JsonResponse;

class ThemeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(ColorTheme::all());
    }
}
