<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemoriesMap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Facades\Log;
use Throwable;

class MapController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'cursor' => ['nullable', 'string'],
            'sort' => ['nullable', 'in:updated_at_desc,updated_at_asc,name_asc,name_desc'],
        ]);

        $query = $request->user()
            ->memoriesMaps()
            ->with('colorTheme')
            ->withCount('mediaFiles');

        $sort = (string) ($validated['sort'] ?? 'updated_at_desc');

        if ($sort === 'updated_at_asc') {
            $query->orderBy('updated_at')->orderBy('id');
        } elseif ($sort === 'name_asc') {
            $query->orderBy('name')->orderBy('id');
        } elseif ($sort === 'name_desc') {
            $query->orderByDesc('name')->orderByDesc('id');
        } else {
            $query->orderByDesc('updated_at')->orderByDesc('id');
        }

        if (!$request->filled('per_page') && !$request->filled('cursor')) {
            return response()->json($query->get());
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $maps = $query->cursorPaginate($perPage, ['*'], 'cursor', $validated['cursor'] ?? null);

        return response()->json([
            'data' => $maps->items(),
            'meta' => [
                'per_page' => $maps->perPage(),
                'next_cursor' => $maps->nextCursor()?->encode(),
                'prev_cursor' => $maps->previousCursor()?->encode(),
                'has_more' => $maps->hasMorePages(),
            ],
        ]);
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
        $map->load('colorTheme')->loadCount('mediaFiles');

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

        try {
            $map->forceDelete();
        } catch (Throwable $e) {
            Log::error('Map delete failed', [
                'map_id' => $map->id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to delete this map right now. Please try again, or contact support if it persists.',
            ], 500);
        }

        return response()->json(null, 204);
    }

    /** Shared (guest) view – stripped of private details */
    public function showShared(Request $request, MemoriesMap $map): JsonResponse
    {
        $map->load([
            'colorTheme',
            'mediaFiles:id,map_id,original_name,mime_type,size_bytes,latitude,longitude,location_name,location_city,captured_at,captured_at_local,timezone,user_caption,thumbnail_name,width,height,duration_seconds',
            'notes',
        ]);

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
