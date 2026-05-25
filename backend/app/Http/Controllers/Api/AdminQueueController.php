<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminQueueController extends Controller
{
    public function health(): JsonResponse
    {
        $jobsTableExists = Schema::hasTable('jobs');
        $failedTableExists = Schema::hasTable('failed_jobs');

        $pendingByQueue = [];
        $oldestSeconds = null;

        if ($jobsTableExists) {
            $pendingByQueue = DB::table('jobs')
                ->selectRaw('queue, COUNT(*) as total')
                ->groupBy('queue')
                ->pluck('total', 'queue')
                ->toArray();

            $oldestCreatedAt = DB::table('jobs')->min('created_at');
            if ($oldestCreatedAt !== null) {
                $oldestSeconds = max(0, now()->timestamp - (int) $oldestCreatedAt);
            }
        }

        $failedTotal = $failedTableExists ? (int) DB::table('failed_jobs')->count() : 0;

        return response()->json([
            'queue_connection' => (string) config('queue.default', 'database'),
            'queue_name' => (string) config('app.media_processing_queue', 'media-processing'),
            'pending_total' => array_sum(array_map('intval', $pendingByQueue)),
            'pending_by_queue' => $pendingByQueue,
            'failed_total' => $failedTotal,
            'oldest_pending_age_seconds' => $oldestSeconds,
            'worker_recommendation' => 'php artisan queue:work --queue=' . config('app.media_processing_queue', 'media-processing') . ',default --tries=' . (int) config('app.media_processing_tries', 5),
        ]);
    }

    public function replayFailed(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'all' => ['nullable', 'boolean'],
        ]);

        $all = (bool) ($validated['all'] ?? false);
        $id = $validated['id'] ?? null;

        if (!$all && $id === null) {
            return response()->json([
                'message' => 'Provide either id or all=true.',
            ], 422);
        }

        $exit = Artisan::call('queue:failed-replay', [
            '--id' => $id,
            '--all' => $all,
        ]);

        return response()->json([
            'ok' => $exit === 0,
            'exit_code' => $exit,
            'output' => trim(Artisan::output()),
        ], $exit === 0 ? 200 : 422);
    }
}
