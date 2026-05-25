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

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'cursor' => ['nullable', 'string'],
            'note_type' => ['nullable', 'in:map,day,location,media'],
            'media_id' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:day_date_asc,day_date_desc,created_at_desc'],
        ]);

        $query = $map->notes();

        if (!empty($validated['note_type'])) {
            $query->where('note_type', $validated['note_type']);
        }

        if (!empty($validated['media_id'])) {
            $query->where('media_id', (int) $validated['media_id']);
        }

        if (!empty($validated['search'])) {
            $search = (string) $validated['search'];
            $query->where(function ($inner) use ($search) {
                $inner->where('title', 'like', '%' . $search . '%')
                    ->orWhere('body', 'like', '%' . $search . '%');
            });
        }

        $sort = (string) ($validated['sort'] ?? 'day_date_asc');
        if ($sort === 'day_date_desc') {
            $query->orderByDesc('day_date')->orderByDesc('id');
        } elseif ($sort === 'created_at_desc') {
            $query->orderByDesc('created_at')->orderByDesc('id');
        } else {
            $query->orderBy('day_date')->orderBy('id');
        }

        if (!$request->filled('per_page') && !$request->filled('cursor')) {
            return response()->json($query->get());
        }

        $perPage = (int) ($validated['per_page'] ?? 30);
        $page = $query->cursorPaginate($perPage, ['*'], 'cursor', $validated['cursor'] ?? null);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'per_page' => $page->perPage(),
                'next_cursor' => $page->nextCursor()?->encode(),
                'prev_cursor' => $page->previousCursor()?->encode(),
                'has_more' => $page->hasMorePages(),
            ],
        ]);
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
        return response()->json($map->notes()->orderBy('day_date')->orderBy('id')->get());
    }
}
