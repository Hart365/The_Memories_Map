<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ColorTheme extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'slug',
        'primary_color',
        'secondary_color',
        'accent_color',
        'background_color',
        'text_color',
        'map_tile_style',
        'is_high_contrast',
    ];

    protected function casts(): array
    {
        return [
            'is_high_contrast' => 'boolean',
        ];
    }

    public function memoriesMaps()
    {
        return $this->hasMany(MemoriesMap::class);
    }
}
