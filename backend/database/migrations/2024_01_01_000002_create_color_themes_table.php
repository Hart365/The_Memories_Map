<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('color_themes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('primary_color', 7);
            $table->string('secondary_color', 7);
            $table->string('accent_color', 7);
            $table->string('background_color', 7);
            $table->string('text_color', 7);
            $table->string('map_tile_style')->default('openstreetmap');
            $table->boolean('is_high_contrast')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('color_themes');
    }
};
