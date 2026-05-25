<?php

namespace App\Models;

use App\Casts\EncryptedStringOrPlaintextCast;
use App\Services\MediaProcessingService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MemoriesMap extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'map_uid',
        'name',
        'description',
        'color_theme_id',
        'is_public',
    ];

    protected function casts(): array
    {
        return [
            'name' => EncryptedStringOrPlaintextCast::class,
            'description' => EncryptedStringOrPlaintextCast::class,
            'is_public' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function mediaFiles()
    {
        return $this->hasMany(MediaFile::class, 'map_id');
    }

    public function notes()
    {
        return $this->hasMany(MapNote::class, 'map_id');
    }

    public function guests()
    {
        return $this->hasMany(MapGuest::class, 'map_id');
    }

    public function colorTheme()
    {
        return $this->belongsTo(ColorTheme::class);
    }

    protected static function booted(): void
    {
        static::creating(function (self $map): void {
            if (empty($map->map_uid)) {
                $map->map_uid = (string) Str::uuid();
            }
        });

        static::deleting(function (self $map): void {
            /** @var MediaProcessingService $mediaProcessor */
            $mediaProcessor = app(MediaProcessingService::class);

            $map->mediaFiles()->withTrashed()->get()->each(function (MediaFile $media) use ($mediaProcessor): void {
                $mediaProcessor->delete($media);
            });
        });
    }
}
