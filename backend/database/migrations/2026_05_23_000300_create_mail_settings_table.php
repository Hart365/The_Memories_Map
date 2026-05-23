<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_settings', function (Blueprint $table) {
            $table->id();
            $table->string('mailer', 20)->default('log');
            $table->string('host')->nullable();
            $table->unsignedSmallInteger('port')->nullable();
            $table->string('username')->nullable();
            $table->text('password_encrypted')->nullable();
            $table->string('encryption', 10)->nullable();
            $table->string('from_address')->nullable();
            $table->string('from_name')->nullable();
            $table->unsignedSmallInteger('timeout')->nullable();
            $table->string('ehlo_domain')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_settings');
    }
};
