<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapNote;
use App\Models\MemoriesMap;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('view', $map);
        return response()->json($map->notes()->orderBy('day_date')->get());
    }

    public function store(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $validated = $request->validate([
            'note_type' => ['required', 'in:map,day,location,media'],
            'media_id'  => ['nullable', 'integer', 'exists:media_files,id'],
            'day_date'  => ['nullable', 'date'],
            'latitude'  => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'title'     => ['nullable', 'string', 'max:255'],
            'body'      => ['required', 'string', 'max:5000'],
        ]);

        $note = $map->notes()->create($validated);

        return response()->json($note, 201);
    }

    public function show(Request $request, MapNote $note): JsonResponse
    {
        $this->authorize('view', $note->map);
        return response()->json($note->load('media'));
    }

    public function update(Request $request, MapNote $note): JsonResponse
    {
        $this->authorize('update', $note->map);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'body'  => ['required', 'string', 'max:5000'],
        ]);

        $note->update($validated);

        return response()->json($note->fresh());
    }

    public function destroy(Request $request, MapNote $note): JsonResponse
    {
        $this->authorize('update', $note->map);
        $note->delete();

        return response()->json(null, 204);
    }

    public function indexShared(MemoriesMap $map): JsonResponse
    {
        return response()->json($map->notes()->orderBy('day_date')->get());
    }
}
