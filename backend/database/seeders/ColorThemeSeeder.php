<?php

namespace Database\Seeders;

use App\Models\ColorTheme;
use Illuminate\Database\Seeder;

class ColorThemeSeeder extends Seeder
{
    public function run(): void
    {
        $themes = [
            [
                'name'             => 'Classic Blue',
                'slug'             => 'classic-blue',
                'primary_color'    => '#1A5276',
                'secondary_color'  => '#2E86C1',
                'accent_color'     => '#F39C12',
                'background_color' => '#F8F9FA',
                'text_color'       => '#212529',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => false,
            ],
            [
                'name'             => 'Forest Green',
                'slug'             => 'forest-green',
                'primary_color'    => '#1E8449',
                'secondary_color'  => '#27AE60',
                'accent_color'     => '#E67E22',
                'background_color' => '#F9FBF9',
                'text_color'       => '#1B2631',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => false,
            ],
            [
                'name'             => 'Sunset',
                'slug'             => 'sunset',
                'primary_color'    => '#922B21',
                'secondary_color'  => '#CB4335',
                'accent_color'     => '#F1C40F',
                'background_color' => '#FDF2E9',
                'text_color'       => '#1B2631',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => false,
            ],
            [
                'name'             => 'Monochrome',
                'slug'             => 'monochrome',
                'primary_color'    => '#212529',
                'secondary_color'  => '#495057',
                'accent_color'     => '#6C757D',
                'background_color' => '#F8F9FA',
                'text_color'       => '#212529',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => false,
            ],
            [
                'name'             => 'High Contrast',
                'slug'             => 'high-contrast',
                'primary_color'    => '#000000',
                'secondary_color'  => '#FFFFFF',
                'accent_color'     => '#FFFF00',
                'background_color' => '#000000',
                'text_color'       => '#FFFFFF',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => true,
            ],
            [
                'name'             => 'Ocean',
                'slug'             => 'ocean',
                'primary_color'    => '#0E4D6E',
                'secondary_color'  => '#1A7FA8',
                'accent_color'     => '#48C9B0',
                'background_color' => '#EBF5FB',
                'text_color'       => '#1B2631',
                'map_tile_style'   => 'openstreetmap',
                'is_high_contrast' => false,
            ],
        ];

        foreach ($themes as $theme) {
            ColorTheme::firstOrCreate(['slug' => $theme['slug']], $theme);
        }
    }
}
