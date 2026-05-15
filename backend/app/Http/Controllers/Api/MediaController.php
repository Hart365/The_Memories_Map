<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use App\Models\MemoriesMap;
use App\Services\MediaProcessingService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;

class MediaController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly MediaProcessingService $processor) {}

    public function index(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('view', $map);

        $query = $map->mediaFiles()->orderBy('captured_at');

        if ($request->filled('date')) {
            $query->whereDate('captured_at', $request->date);
        }

        if ($request->filled('has_location')) {
            $query->whereNotNull('latitude')->whereNotNull('longitude');
        }

        return response()->json($query->paginate(50));
    }

    public function store(Request $request, MemoriesMap $map): JsonResponse
    {
        $this->authorize('update', $map);

        $maxMb = (int) config('app.max_upload_size_mb', 500);

        $request->validate([
            'files'   => ['required', 'array', 'max:50'],
            'files.*' => [
                'required',
                File::types(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'mkv', 'm4v'])
                    ->max($maxMb * 1024),
            ],
        ]);

        $created = [];

        foreach ($request->file('files') as $upload) {
            $media = $this->processor->ingest($upload, $map);
            $created[] = $media;
        }

        return response()->json($created, 201);
    }

    public function show(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('view', $map);
        $this->ensureBelongsToMap($media, $map);

        return response()->json($media->load('notes'));
    }

    public function update(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('update', $map);
        $this->ensureBelongsToMap($media, $map);

        $validated = $request->validate([
            'user_caption' => ['nullable', 'string', 'max:2000'],
            'user_tags'    => ['nullable', 'array'],
            'user_tags.*'  => ['string', 'max:100'],
            'captured_at'  => ['nullable', 'date'],
            'latitude'     => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'    => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $media->update($validated);

        return response()->json($media->fresh());
    }

    public function destroy(Request $request, MemoriesMap $map, MediaFile $media): JsonResponse
    {
        $this->authorize('update', $map);
        $this->ensureBelongsToMap($media, $map);

        $this->processor->delete($media);

        return response()->json(null, 204);
    }

    /** Serve the raw media file (owner only). */
    public function serveFile(Request $request, MemoriesMap $map, MediaFile $media): Response
    {
        $this->authorize('view', $map);
        $this->ensureBelongsToMap($media, $map);

        $path = $this->processor->storagePath($media->stored_name);

        abort_unless(file_exists($path), 404);

        return response()->file($path, [
            'Content-Type' => $media->mime_type,
        ]);
    }

    /** Serve the thumbnail (also accessible to guests). */
    public function serveThumbnail(MemoriesMap $map, MediaFile $media): Response
    {
        $this->ensureBelongsToMap($media, $map);

        $path = $this->processor->thumbnailPath($media->thumbnail_name);

        abort_unless($path && file_exists($path), 404);

        return response()->file($path, ['Content-Type' => 'image/webp']);
    }

    public function indexShared(MemoriesMap $map): JsonResponse
    {
        $media = $map->mediaFiles()
            ->select('id', 'map_id', 'latitude', 'longitude', 'captured_at', 'thumbnail_name', 'user_caption', 'mime_type')
            ->orderBy('captured_at')
            ->paginate(50);

        return response()->json($media);
    }

    private function ensureBelongsToMap(MediaFile $media, MemoriesMap $map): void
    {
        abort_if($media->map_id !== $map->id, 404);
    }
}
