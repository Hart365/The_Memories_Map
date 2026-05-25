<?php

namespace App\Models;

use App\Casts\EncryptedJsonOrPlaintextCast;
use App\Casts\EncryptedStringOrPlaintextCast;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MediaFile extends Model
{
    use HasFactory, SoftDeletes;

    public const PROCESSING_QUEUED = 'queued';
    public const PROCESSING_PROCESSING = 'processing';
    public const PROCESSING_COMPLETED = 'completed';
    public const PROCESSING_FAILED = 'failed';

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
        'processing_status',
        'processing_stage',
        'processing_attempts',
        'processing_error',
        'processing_started_at',
        'processing_finished_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude'         => 'float',
            'longitude'        => 'float',
            'altitude'         => 'float',
            'original_name'    => EncryptedStringOrPlaintextCast::class,
            'location_name'    => EncryptedStringOrPlaintextCast::class,
            'location_address' => EncryptedStringOrPlaintextCast::class,
            'location_city'    => EncryptedStringOrPlaintextCast::class,
            'location_country' => EncryptedStringOrPlaintextCast::class,
            'captured_at'      => 'datetime',
            'captured_at_local' => 'datetime',
            'camera_make'      => EncryptedStringOrPlaintextCast::class,
            'camera_model'     => EncryptedStringOrPlaintextCast::class,
            'processed_at'     => 'datetime',
            'processing_started_at' => 'datetime',
            'processing_finished_at' => 'datetime',
            'exif_json'        => EncryptedJsonOrPlaintextCast::class,
            'user_caption'     => EncryptedStringOrPlaintextCast::class,
            'user_tags'        => EncryptedJsonOrPlaintextCast::class,
            'size_bytes'       => 'integer',
            'width'            => 'integer',
            'height'           => 'integer',
            'duration_seconds' => 'float',
            'timezone_offset'  => 'integer',
            'processing_attempts' => 'integer',
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
