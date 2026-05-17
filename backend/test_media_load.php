<?php

require '/var/www/memories-map/backend/vendor/autoload.php';

$app = require_once '/var/www/memories-map/backend/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$map = App\Models\MemoriesMap::find(1);
$map->load(['mediaFiles']);

echo "Media files loaded: " . $map->mediaFiles->count() . PHP_EOL;
echo "First 5 file IDs: " . $map->mediaFiles->take(5)->pluck('id')->join(', ') . PHP_EOL;
echo "Last 5 file IDs: " . $map->mediaFiles->reverse()->take(5)->pluck('id')->join(', ') . PHP_EOL;

// Check the JSON serialization
$json = $map->toJson();
$decoded = json_decode($json, true);
echo "JSON media_files count: " . count($decoded['media_files'] ?? []) . PHP_EOL;
