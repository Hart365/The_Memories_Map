<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('map_id')->constrained('memories_maps')->cascadeOnDelete();
            $table->foreignId('media_id')->nullable()->constrained('media_files')->nullOnDelete();
            $table->enum('note_type', ['map', 'day', 'location', 'media'])->default('map');
            $table->date('day_date')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 11, 7)->nullable();
            $table->string('title')->nullable();
            $table->text('body');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['map_id', 'day_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_notes');
    }
};
