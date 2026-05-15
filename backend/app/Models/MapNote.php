<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapNote extends Model
{
    use HasFactory, SoftDeletes;

    // note_type: 'map' | 'day' | 'location' | 'media'
    protected $fillable = [
        'map_id',
        'media_id',
        'note_type',
        'day_date',
        'latitude',
        'longitude',
        'title',
        'body',
    ];

    protected function casts(): array
    {
        return [
            'day_date'  => 'date',
            'latitude'  => 'float',
            'longitude' => 'float',
        ];
    }

    public function map()
    {
        return $this->belongsTo(MemoriesMap::class, 'map_id');
    }

    public function media()
    {
        return $this->belongsTo(MediaFile::class, 'media_id');
    }
}
