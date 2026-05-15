<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemoriesMap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

class MapController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $maps = $request->user()
            ->memoriesMaps()
            ->with('colorTheme')
            ->withCount('mediaFiles')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json($maps);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['nullable', 'string', 'max:2000'],
            'color_theme_id' => ['nullable', 'integer', 'exists:color_themes,id'],
        ]);

        $map = $request->user()->memoriesMaps()->create($validated);
        $map->load('colorTheme');

        return response()->json($map, 201);
    }

    public function show(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('view', $map);
        $map->load(['colorTheme', 'mediaFiles', 'notes']);

        return response()->json($map);
    }

    public function update(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $validated = $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'description'    => ['nullable', 'string', 'max:2000'],
            'color_theme_id' => ['nullable', 'integer', 'exists:color_themes,id'],
        ]);

        $map->update($validated);

        return response()->json($map->fresh('colorTheme'));
    }

    public function updateTheme(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $validated = $request->validate([
            'color_theme_id' => ['required', 'integer', 'exists:color_themes,id'],
        ]);

        $map->update($validated);

        return response()->json($map->fresh('colorTheme'));
    }

    public function destroy(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('delete', $map);
        $map->delete();

        return response()->json(null, 204);
    }

    /** Shared (guest) view – stripped of private details */
    public function showShared(Request $request, MemoriesMap $map): JsonResponse
    {
        $map->load(['colorTheme', 'mediaFiles:id,map_id,latitude,longitude,captured_at,thumbnail_name,user_caption', 'notes']);

        return response()->json([
            'id'          => $map->id,
            'name'        => $map->name,
            'description' => $map->description,
            'color_theme' => $map->colorTheme,
            'media'       => $map->mediaFiles,
            'notes'       => $map->notes,
        ]);
    }
}
