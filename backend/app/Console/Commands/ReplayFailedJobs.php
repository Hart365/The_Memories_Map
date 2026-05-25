<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ReplayFailedJobs extends Command
{
    protected $signature = 'queue:failed-replay {--id= : Replay a single failed job ID} {--all : Replay all failed jobs}';

    protected $description = 'Replay failed queue jobs safely with explicit filtering';

    public function handle(): int
    {
        if (!Schema::hasTable('failed_jobs')) {
            $this->warn('No failed_jobs table found.');
            return self::SUCCESS;
        }

        $id = $this->option('id');
        $all = (bool) $this->option('all');

        if (!$all && ($id === null || $id === '')) {
            $this->error('Provide either --id=<failed-job-id> or --all.');
            return self::INVALID;
        }

        if ($id !== null && $id !== '') {
            $failed = DB::table('failed_jobs')->where('id', (int) $id)->exists();
            if (!$failed) {
                $this->warn('Failed job not found: ' . $id);
                return self::SUCCESS;
            }

            $this->line('Replaying failed job ID ' . $id . '...');
            $exit = Artisan::call('queue:retry', ['id' => [(string) $id]]);
            $this->line(trim(Artisan::output()));

            return $exit === 0 ? self::SUCCESS : self::FAILURE;
        }

        $ids = DB::table('failed_jobs')->orderBy('id')->pluck('id')->map(static fn ($value): string => (string) $value)->all();

        if (empty($ids)) {
            $this->info('No failed jobs to replay.');
            return self::SUCCESS;
        }

        $this->line('Replaying ' . count($ids) . ' failed job(s)...');
        $exit = Artisan::call('queue:retry', ['id' => $ids]);
        $this->line(trim(Artisan::output()));

        return $exit === 0 ? self::SUCCESS : self::FAILURE;
    }
}
