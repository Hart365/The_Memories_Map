<?php

namespace App\Policies;

use App\Models\MemoriesMap;
use App\Models\User;

class MemoriesMapPolicy
{
    public function view(User $user, MemoriesMap $map): bool
    {
        return (int) $user->id === (int) $map->user_id;
    }

    public function update(User $user, MemoriesMap $map): bool
    {
        return (int) $user->id === (int) $map->user_id;
    }

    public function delete(User $user, MemoriesMap $map): bool
    {
        return (int) $user->id === (int) $map->user_id;
    }
}
