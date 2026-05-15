<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('map_id')->constrained('memories_maps')->cascadeOnDelete();
            $table->string('email');
            $table->string('password');                // bcrypt hash
            $table->string('access_token', 64)->unique(); // random bearer token
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['map_id', 'email']);
            $table->index(['access_token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_guests');
    }
};
