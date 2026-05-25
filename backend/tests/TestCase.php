<?php

declare(strict_types=1);

namespace Tests;

use App\Models\MemoriesMap;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    protected function createUser(array $overrides = []): User
    {
        $defaults = [
            'name' => 'Test User',
            'email' => 'user-' . Str::lower(Str::random(12)) . '@gmail.com',
            'password' => Hash::make('Password123!'),
            'default_timezone' => 'UTC',
            'date_format' => 'YYYY-MM-DD',
        ];

        /** @var User $user */
        $user = User::query()->create(array_merge($defaults, $overrides));

        return $user;
    }

    protected function createMap(?User $user = null, array $overrides = []): MemoriesMap
    {
        $owner = $user ?? $this->createUser();

        $defaults = [
            'user_id' => $owner->id,
            'name' => 'Map ' . Str::random(8),
            'description' => 'Test map description',
            'is_public' => false,
        ];

        /** @var MemoriesMap $map */
        $map = MemoriesMap::query()->create(array_merge($defaults, $overrides));

        return $map->fresh();
    }
}