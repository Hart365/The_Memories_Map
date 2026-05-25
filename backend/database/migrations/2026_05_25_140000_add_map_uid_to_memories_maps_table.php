<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('memories_maps', function (Blueprint $table) {
            $table->uuid('map_uid')->nullable()->after('user_id')->unique();
        });

        DB::table('memories_maps')
            ->whereNull('map_uid')
            ->orderBy('id')
            ->select('id')
            ->get()
            ->each(function (object $row): void {
                DB::table('memories_maps')
                    ->where('id', $row->id)
                    ->update(['map_uid' => (string) Str::uuid()]);
            });
    }

    public function down(): void
    {
        Schema::table('memories_maps', function (Blueprint $table) {
            $table->dropUnique(['map_uid']);
            $table->dropColumn('map_uid');
        });
    }
};
