<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->string('location_name')->nullable()->after('altitude');
            $table->string('location_address')->nullable()->after('location_name');
            $table->string('location_city')->nullable()->after('location_address');
            $table->string('location_country')->nullable()->after('location_city');
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->dropColumn(['location_name', 'location_address', 'location_city', 'location_country']);
        });
    }
};
