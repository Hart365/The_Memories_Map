<?php

namespace App\Policies;

use App\Models\MemoriesMap;
use App\Models\User;

class MemoriesMapPolicy
{
    public function view(User $user, MemoriesMap $map): bool
    {
        return $user->id === $map->user_id;
    }

    public function update(User $user, MemoriesMap $map): bool
    {
        return $user->id === $map->user_id;
    }

    public function delete(User $user, MemoriesMap $map): bool
    {
        return $user->id === $map->user_id;
    }
}
