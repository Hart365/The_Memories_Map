<?php

use App\Services\TimezoneService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('default_timezone', 100)
                ->default(TimezoneService::DEFAULT_TIMEZONE)
                ->after('email');
        });

        DB::table('users')
            ->whereNull('default_timezone')
            ->update(['default_timezone' => TimezoneService::DEFAULT_TIMEZONE]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('default_timezone');
        });
    }
};
