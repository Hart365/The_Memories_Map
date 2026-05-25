<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('jobs')) {
            Schema::create('jobs', function (Blueprint $table) {
                $table->id();
                $table->string('queue')->index();
                $table->longText('payload');
                $table->unsignedTinyInteger('attempts');
                $table->unsignedInteger('reserved_at')->nullable();
                $table->unsignedInteger('available_at');
                $table->unsignedInteger('created_at');
            });
        }

        if (!Schema::hasTable('job_batches')) {
            Schema::create('job_batches', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('name');
                $table->integer('total_jobs');
                $table->integer('pending_jobs');
                $table->integer('failed_jobs');
                $table->longText('failed_job_ids');
                $table->mediumText('options')->nullable();
                $table->integer('cancelled_at')->nullable();
                $table->integer('created_at');
                $table->integer('finished_at')->nullable();
            });
        }

        if (!Schema::hasTable('failed_jobs')) {
            Schema::create('failed_jobs', function (Blueprint $table) {
                $table->id();
                $table->string('uuid')->unique();
                $table->text('connection');
                $table->text('queue');
                $table->longText('payload');
                $table->longText('exception');
                $table->timestamp('failed_at')->useCurrent();
            });
        }

        Schema::table('media_files', function (Blueprint $table) {
            if (!Schema::hasColumn('media_files', 'processing_status')) {
                $table->string('processing_status', 32)->default('queued')->after('processed_at');
            }

            if (!Schema::hasColumn('media_files', 'processing_stage')) {
                $table->string('processing_stage', 64)->nullable()->after('processing_status');
            }

            if (!Schema::hasColumn('media_files', 'processing_attempts')) {
                $table->unsignedInteger('processing_attempts')->default(0)->after('processing_stage');
            }

            if (!Schema::hasColumn('media_files', 'processing_error')) {
                $table->text('processing_error')->nullable()->after('processing_attempts');
            }

            if (!Schema::hasColumn('media_files', 'processing_started_at')) {
                $table->timestamp('processing_started_at')->nullable()->after('processing_error');
            }

            if (!Schema::hasColumn('media_files', 'processing_finished_at')) {
                $table->timestamp('processing_finished_at')->nullable()->after('processing_started_at');
            }
        });

        Schema::table('media_files', function (Blueprint $table) {
            $table->index(['map_id', 'processing_status'], 'media_files_map_id_processing_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            if (Schema::hasColumn('media_files', 'processing_finished_at')) {
                $table->dropColumn('processing_finished_at');
            }
            if (Schema::hasColumn('media_files', 'processing_started_at')) {
                $table->dropColumn('processing_started_at');
            }
            if (Schema::hasColumn('media_files', 'processing_error')) {
                $table->dropColumn('processing_error');
            }
            if (Schema::hasColumn('media_files', 'processing_attempts')) {
                $table->dropColumn('processing_attempts');
            }
            if (Schema::hasColumn('media_files', 'processing_stage')) {
                $table->dropColumn('processing_stage');
            }
            if (Schema::hasColumn('media_files', 'processing_status')) {
                $table->dropColumn('processing_status');
            }
        });

        if (Schema::hasTable('failed_jobs')) {
            Schema::drop('failed_jobs');
        }
        if (Schema::hasTable('job_batches')) {
            Schema::drop('job_batches');
        }
        if (Schema::hasTable('jobs')) {
            Schema::drop('jobs');
        }
    }
};
