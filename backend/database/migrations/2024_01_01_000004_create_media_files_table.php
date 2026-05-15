<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('map_id')->constrained('memories_maps')->cascadeOnDelete();
            $table->string('original_name');
            $table->string('stored_name')->unique();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            // Location
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 11, 7)->nullable();
            $table->decimal('altitude', 10, 2)->nullable();

            // Temporal
            $table->timestamp('captured_at')->nullable();

            // Camera
            $table->string('camera_make')->nullable();
            $table->string('camera_model')->nullable();

            // Dimensions / duration
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->decimal('duration_seconds', 10, 3)->nullable();

            // Metadata & user annotations
            $table->json('exif_json')->nullable();
            $table->text('user_caption')->nullable();
            $table->json('user_tags')->nullable();

            // Processed thumbnail
            $table->string('thumbnail_name')->nullable();
            $table->timestamp('processed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['map_id', 'captured_at']);
            $table->index(['map_id', 'latitude', 'longitude']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_files');
    }
};
