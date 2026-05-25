<?php

namespace App\Models;

use App\Casts\EncryptedStringOrPlaintextCast;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class MapGuest extends Model
{
    use HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'map_id',
        'email',
        'email_hash',
        'password',
        'access_token',
        'invited_at',
        'expires_at',
        'last_accessed_at',
    ];

    protected $hidden = [
        'password',
        'access_token',
        'email_hash',
    ];

    protected function casts(): array
    {
        return [
            'email'            => EncryptedStringOrPlaintextCast::class,
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

    public static function findByAccessToken(string $plainToken): ?self
    {
        if ($plainToken === '') {
            return null;
        }

        return self::where('access_token', hash('sha256', $plainToken))->first()
            ?? self::where('access_token', $plainToken)->first();
    }

    public static function hashEmail(string $email): string
    {
        return hash('sha256', strtolower(trim($email)));
    }

    public function routeNotificationForMail(): string
    {
        return $this->email;
    }
}
