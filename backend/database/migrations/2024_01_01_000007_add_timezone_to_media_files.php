<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->string('timezone', 100)->nullable()->after('captured_at');
            $table->smallInteger('timezone_offset')->nullable()->after('timezone')->comment('Offset from UTC in minutes');
            $table->timestamp('captured_at_local')->nullable()->after('timezone_offset')->comment('Local time at photo location');
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->dropColumn(['timezone', 'timezone_offset', 'captured_at_local']);
        });
    }
};
