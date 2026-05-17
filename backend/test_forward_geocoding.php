<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$service = $app->make(\App\Services\GeocodingService::class);

echo "================================\n";
echo "Multi-Provider Geocoding Test\n";
echo "================================\n\n";

$testQueries = [
    'Mercer Labs, New York, USA',
    'Mercer Labs, New York, United States of America',
    'Mercer Labs, Manhattan, New York',
    'Eiffel Tower, Paris',
    'Times Square, New York',
];

foreach ($testQueries as $query) {
    echo "Testing: {$query}\n";
    echo str_repeat('-', 60) . "\n";
    
    $result = $service->forwardGeocode($query);
    
    if ($result) {
        echo "✅ SUCCESS!\n";
        echo "  Name: " . ($result['name'] ?? 'N/A') . "\n";
        echo "  Address: " . ($result['address'] ?? 'N/A') . "\n";
        echo "  City: " . ($result['city'] ?? 'N/A') . "\n";
        echo "  Country: " . ($result['country'] ?? 'N/A') . "\n";
        echo "  Latitude: " . ($result['lat'] ?? 'N/A') . "\n";
        echo "  Longitude: " . ($result['lon'] ?? 'N/A') . "\n";
    } else {
        echo "❌ FAILED: No results found\n";
    }
    
    echo "\n";
}

echo "================================\n";
echo "Check storage/logs/laravel.log for detailed provider logs\n";
echo "================================\n";
