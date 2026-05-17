<?php

/**
 * Test script to verify GeocodingService functionality
 * Run: docker compose exec app php /var/www/memories-map/backend/test_geocoding.php
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\GeocodingService;

echo "Testing GeocodingService...\n\n";

$geocoder = new GeocodingService();

// Test coordinates (Eiffel Tower, Paris)
$lat = 48.8584;
$lng = 2.2945;

echo "Testing reverse geocoding for coordinates:\n";
echo "Latitude: $lat\n";
echo "Longitude: $lng\n";
echo "Expected: Eiffel Tower area, Paris, France\n\n";

echo "Making API request...\n";
$start = microtime(true);

try {
    $result = $geocoder->reverseGeocode($lat, $lng);
    $elapsed = round((microtime(true) - $start) * 1000, 2);
    
    if ($result) {
        echo "✅ SUCCESS (took {$elapsed}ms)\n\n";
        echo "Results:\n";
        echo "  Name: " . ($result['name'] ?? 'N/A') . "\n";
        echo "  Address: " . ($result['address'] ?? 'N/A') . "\n";
        echo "  City: " . ($result['city'] ?? 'N/A') . "\n";
        echo "  Country: " . ($result['country'] ?? 'N/A') . "\n\n";
        
        // Test caching - should be instant
        echo "Testing cache (should be instant)...\n";
        $start2 = microtime(true);
        $result2 = $geocoder->reverseGeocode($lat, $lng);
        $elapsed2 = round((microtime(true) - $start2) * 1000, 2);
        echo "✅ Cache hit! (took {$elapsed2}ms)\n\n";
        
        if ($elapsed2 < 10) {
            echo "✅ Caching is working correctly!\n";
        } else {
            echo "⚠️ Cache seems slow, may not be working\n";
        }
    } else {
        echo "❌ FAILED - No result returned\n";
        echo "Check your internet connection and try again\n";
    }
} catch (\Throwable $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n✅ Test complete!\n";
