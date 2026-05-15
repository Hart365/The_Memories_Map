<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MapGuest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'map_id',
        'email',
        'password',
        'access_token',
        'invited_at',
        'expires_at',
        'last_accessed_at',
    ];

    protected $hidden = [
        'password',
        'access_token',
    ];

    protected function casts(): array
    {
        return [
            'password'         => 'hashed',
            'invited_at'       => 'datetime',
            'expires_at'       => 'datetime',
            'last_accessed_at' => 'datetime',
        ];
    }

    public function map()
    {
        return $this->belongsTo(MemoriesMap::class, 'map_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public static function generateAccessToken(): string
    {
        return Str::random(64);
    }
}
