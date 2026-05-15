<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MemoriesMap extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'color_theme_id',
        'is_public',
    ];

    protected function casts(): array
    {
        return [
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
}
