<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MediaFile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'map_id',
        'original_name',
        'stored_name',
        'mime_type',
        'size_bytes',
        'latitude',
        'longitude',
        'altitude',
        'location_name',
        'location_address',
        'location_city',
        'location_country',
        'captured_at',
        'timezone',
        'timezone_offset',
        'captured_at_local',
        'camera_make',
        'camera_model',
        'width',
        'height',
        'duration_seconds',
        'exif_json',
        'user_caption',
        'user_tags',
        'thumbnail_name',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude'         => 'float',
            'longitude'        => 'float',
            'altitude'         => 'float',
            'captured_at'      => 'datetime',
            'captured_at_local' => 'datetime',
            'processed_at'     => 'datetime',
            'exif_json'        => 'array',
            'user_tags'        => 'array',
            'size_bytes'       => 'integer',
            'width'            => 'integer',
            'height'           => 'integer',
            'duration_seconds' => 'float',
            'timezone_offset'  => 'integer',
        ];
    }

    public function map()
    {
        return $this->belongsTo(MemoriesMap::class, 'map_id');
    }

    public function notes()
    {
        return $this->hasMany(MapNote::class, 'media_id');
    }

    public function isVideo(): bool
    {
        return str_starts_with($this->mime_type ?? '', 'video/');
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime_type ?? '', 'image/');
    }
}
