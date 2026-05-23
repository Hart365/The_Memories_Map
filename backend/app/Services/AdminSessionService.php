<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AdminSessionService
{
    public function createToken(): string
    {
        $token = Str::random(64);
        Cache::put($this->cacheKey($token), true, now()->addHours(12));

        return $token;
    }

    public function isValidToken(?string $token): bool
    {
        if (! $token) {
            return false;
        }

        return (bool) Cache::get($this->cacheKey($token), false);
    }

    public function invalidateToken(?string $token): void
    {
        if (! $token) {
            return;
        }

        Cache::forget($this->cacheKey($token));
    }

    private function cacheKey(string $token): string
    {
        return 'admin:session:' . hash('sha256', $token);
    }
}
