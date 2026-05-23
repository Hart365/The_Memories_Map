<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('date_format', 20)
                ->default('YYYY-MM-DD')
                ->after('default_timezone');
        });

        DB::table('users')
            ->whereNull('date_format')
            ->update(['date_format' => 'YYYY-MM-DD']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('date_format');
        });
    }
};
