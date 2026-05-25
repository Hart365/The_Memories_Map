<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->index(['captured_at', 'id'], 'media_files_captured_at_id_index');
            $table->index(['latitude', 'longitude', 'id'], 'media_files_lat_lon_id_index');
            $table->index(['map_id', 'created_at', 'id'], 'media_files_map_created_id_index');
        });

        Schema::table('memories_maps', function (Blueprint $table) {
            $table->index(['user_id', 'updated_at', 'id'], 'memories_maps_owner_updated_id_index');
        });

        Schema::table('map_notes', function (Blueprint $table) {
            $table->index(['map_id', 'created_at', 'id'], 'map_notes_map_created_id_index');
            $table->index(['note_type', 'map_id'], 'map_notes_type_map_id_index');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE map_notes ADD FULLTEXT map_notes_title_body_fulltext (title, body)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            try {
                DB::statement('ALTER TABLE map_notes DROP INDEX map_notes_title_body_fulltext');
            } catch (\Throwable) {
                // Ignore if index does not exist.
            }
        }

        Schema::table('map_notes', function (Blueprint $table) {
            $table->dropIndex('map_notes_type_map_id_index');
            $table->dropIndex('map_notes_map_created_id_index');
        });

        Schema::table('memories_maps', function (Blueprint $table) {
            $table->dropIndex('memories_maps_owner_updated_id_index');
        });

        Schema::table('media_files', function (Blueprint $table) {
            $table->dropIndex('media_files_map_created_id_index');
            $table->dropIndex('media_files_lat_lon_id_index');
            $table->dropIndex('media_files_captured_at_id_index');
        });
    }
};
