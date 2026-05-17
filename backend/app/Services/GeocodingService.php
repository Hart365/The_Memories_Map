<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class GeocodingService
{
    // Multiple provider URLs for redundancy and better coverage
    private const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
    private const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
    private const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
    private const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
    
    private const CACHE_TTL = 86400 * 30; // 30 days
    private const RATE_LIMIT_DELAY = 1; // 1 second between requests (Nominatim requirement)

    /**
     * Reverse geocode a lat/lng pair to get location details.
     * Results are cached to avoid repeated API calls.
     * Uses two-tier approach: precise zoom (18) for POIs, broader zoom (15) for neighborhoods.
     *
     * @return array{name: ?string, address: ?string, city: ?string, country: ?string}|null
     */
    public function reverseGeocode(?float $lat, ?float $lng): ?array
    {
        if ($lat === null || $lng === null) {
            return null;
        }

        // Check cache first
        $cacheKey = "geocode:{$lat}:{$lng}";
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        try {
            // Tier 1: Try zoom 18 (most precise) - best for POIs, landmarks, buildings
            $result = $this->fetchGeocode($lat, $lng, 18);
            
            if ($result) {
                // Check if we got a meaningful POI (not just a street address)
                $hasPoi = $this->hasPoi($result['_raw_address'] ?? []);
                
                if ($hasPoi) {
                    // Got a POI! Cache and return
                    unset($result['_raw_address']); // Remove internal field
                    Cache::put($cacheKey, $result, self::CACHE_TTL);
                    return $result;
                }
            }
            
            // Tier 2: No POI found at zoom 18, try zoom 15 for neighborhood name
            $this->rateLimit(); // Respect rate limit before second call
            $result = $this->fetchGeocode($lat, $lng, 15);
            
            if ($result) {
                unset($result['_raw_address']);
                Cache::put($cacheKey, $result, self::CACHE_TTL);
                return $result;
            }

            return null;
        } catch (\Throwable $e) {
            \Log::warning('Geocoding failed', [
                'lat' => $lat,
                'lng' => $lng,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Fetch geocode data from Nominatim at specified zoom level.
     */
    private function fetchGeocode(float $lat, float $lng, int $zoom): ?array
    {
        $this->rateLimit();

        $response = Http::timeout(10)
            ->withHeaders(['User-Agent' => 'MemoriesMap/1.0 (Laravel)'])
            ->get(self::NOMINATIM_URL, [
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
                'addressdetails' => 1,
                'extratags' => 1,
                'namedetails' => 1,
                'zoom' => $zoom,
            ]);

        if (!$response->successful() || !isset($response->json()['address'])) {
            return null;
        }

        $data = $response->json();
        $address = $data['address'];

        $locationName = $this->extractLocationName($data, $address);

        return [
            'name' => $locationName,
            'address' => $this->formatAddress($address),
            'city' => $address['city'] 
                ?? $address['town'] 
                ?? $address['village'] 
                ?? $address['municipality'] 
                ?? null,
            'country' => $address['country'] ?? null,
            '_raw_address' => $address, // Keep for POI detection
        ];
    }

    /**
     * Rate limiting helper - ensure minimum delay between API calls.
     */
    private function rateLimit(): void
    {
        $lastCall = Cache::get('geocode:last_call', 0);
        $elapsed = microtime(true) - $lastCall;
        if ($elapsed < self::RATE_LIMIT_DELAY) {
            usleep((int) ((self::RATE_LIMIT_DELAY - $elapsed) * 1000000));
        }
        Cache::put('geocode:last_call', microtime(true), 60);
    }

    /**
     * Check if the address contains a meaningful POI (not just a street address).
     */
    private function hasPoi(array $address): bool
    {
        $poiFields = ['tourism', 'amenity', 'historic', 'leisure', 'building'];
        
        foreach ($poiFields as $field) {
            if (!empty($address[$field]) && 
                !in_array(strtolower($address[$field]), ['yes', 'building'], true)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Extract the most relevant location name from Nominatim response.
     * Prioritizes POIs, landmarks, buildings over generic street names.
     */
    private function extractLocationName(array $data, array $address): ?string
    {
        // Priority 1: Check for explicit 'name' field (often contains POI names)
        if (!empty($data['name']) && $data['name'] !== ($data['display_name'] ?? '')) {
            // Prefer short, clean names (likely POIs) over long address strings
            if (strlen($data['name']) < 100 && !str_contains($data['name'], ',')) {
                return $data['name'];
            }
        }

        // Priority 2: Named POIs from address fields (hotels, attractions, landmarks)
        $poiFields = [
            'tourism',      // Hotels, attractions, museums
            'amenity',      // Restaurants, shops, parks
            'historic',     // Historic sites, monuments
            'leisure',      // Parks, gardens, stadiums
            'building',     // Named buildings
        ];

        foreach ($poiFields as $field) {
            if (!empty($address[$field])) {
                // If it's a descriptive name (not just the type), use it
                if (!in_array(strtolower($address[$field]), ['yes', 'building', 'hotel', 'attraction'])) {
                    return $address[$field];
                }
            }
        }

        // Priority 3: Specific POI categories
        if (!empty($address['attraction'])) return $address['attraction'];
        if (!empty($address['hotel'])) return $address['hotel'];
        if (!empty($address['restaurant'])) return $address['restaurant'];
        if (!empty($address['shop'])) return $address['shop'];
        if (!empty($address['park'])) return $address['park'];
        
        // Priority 4: If display_name is short and simple, use it
        if (!empty($data['display_name'])) {
            // If it's a short name without too many commas (likely a simple location name)
            if (strlen($data['display_name']) < 80 && substr_count($data['display_name'], ',') <= 3) {
                return $data['display_name'];
            }
            
            // Try to extract the first meaningful part before excessive detail
            $parts = explode(',', $data['display_name']);
            if (count($parts) > 0 && strlen(trim($parts[0])) < 50) {
                return trim($parts[0]);
            }
        }
        
        // Priority 5: Fall back to null (will use full display_name in last resort)
        return $data['display_name'] ?? null;
    }

    /**
     * Format address components into a readable string.
     */
    private function formatAddress(array $address): ?string
    {
        $parts = array_filter([
            $address['house_number'] ?? null,
            $address['road'] ?? null,
            $address['suburb'] ?? null,
            $address['postcode'] ?? null,
        ]);

        return !empty($parts) ? implode(', ', $parts) : null;
    }

    /**
     * Forward geocode - search for a location by text query.
     * Returns coordinates and location details for the best match.
     * Tries multiple geocoding providers for better coverage.
     *
     * @param string $query The search query (e.g., "Eiffel Tower, Paris" or "123 Main St, New York")
     * @return array{name: ?string, address: ?string, city: ?string, country: ?string, lat: ?float, lon: ?float}|null
     */
    public function forwardGeocode(string $query): ?array
    {
        if (empty(trim($query))) {
            \Log::warning('Geocoding: Empty query provided');
            return null;
        }

        $originalQuery = trim($query);

        // Check cache first
        $cacheKey = "geocode_search:" . md5(strtolower($originalQuery));
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            \Log::info('Geocoding: Cache hit', ['query' => $originalQuery]);
            return $cached;
        }

        \Log::info('Geocoding: Starting search', ['query' => $originalQuery]);

        // Try multiple providers in sequence for better coverage
        $providers = [
            'photon' => fn() => $this->forwardGeocodePhoton($originalQuery),
            'nominatim' => fn() => $this->forwardGeocodeNominatim($originalQuery),
        ];

        foreach ($providers as $providerName => $providerFn) {
            try {
                \Log::debug("Geocoding: Trying provider: {$providerName}", ['query' => $originalQuery]);
                
                $result = $providerFn();
                
                if ($result) {
                    \Log::info("Geocoding: SUCCESS with {$providerName}", [
                        'query' => $originalQuery,
                        'name' => $result['name'] ?? 'N/A',
                        'lat' => $result['lat'] ?? 'N/A',
                        'lon' => $result['lon'] ?? 'N/A',
                    ]);
                    
                    // Cache the successful result
                    Cache::put($cacheKey, $result, self::CACHE_TTL);
                    return $result;
                }
                
                \Log::debug("Geocoding: No results from {$providerName}", ['query' => $originalQuery]);
            } catch (\Throwable $e) {
                \Log::warning("Geocoding: Provider {$providerName} failed", [
                    'query' => $originalQuery,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        \Log::warning('Geocoding: All providers failed', [
            'query' => $originalQuery,
            'providers_tried' => array_keys($providers),
        ]);
        
        return null;
    }

    /**
     * Forward geocode using Photon API (fast, no rate limiting).
     */
    private function forwardGeocodePhoton(string $query): ?array
    {
        try {
            $response = Http::timeout(10)
                ->get(self::PHOTON_SEARCH_URL, [
                    'q' => $query,
                    'limit' => 5,
                    'lang' => 'en',
                ]);

            if (!$response->successful() || empty($response->json()['features'])) {
                return null;
            }

            $features = $response->json()['features'];
            if (empty($features)) {
                return null;
            }

            // Get best match (first result is usually best)
            $feature = $features[0];
            $props = $feature['properties'] ?? [];
            $coords = $feature['geometry']['coordinates'] ?? null;

            if (!$coords || count($coords) < 2) {
                return null;
            }

            // Photon returns [lon, lat] (GeoJSON format)
            $lon = (float) $coords[0];
            $lat = (float) $coords[1];

            return [
                'name' => $props['name'] ?? $props['street'] ?? null,
                'address' => $this->formatPhotonAddress($props),
                'city' => $props['city'] ?? $props['town'] ?? $props['village'] ?? null,
                'country' => $props['country'] ?? null,
                'lat' => $lat,
                'lon' => $lon,
            ];
        } catch (\Throwable $e) {
            \Log::debug('Photon geocoding failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Forward geocode using Nominatim API (comprehensive, but rate-limited).
     */
    private function forwardGeocodeNominatim(string $originalQuery): ?array
    {
        try {
            // Try multiple query variations for better results
            $queries = $this->buildQueryVariations($originalQuery);
            
            foreach ($queries as $tryQuery) {
                $this->rateLimit();

                \Log::debug('Trying Nominatim query', ['query' => $tryQuery]);

                $response = Http::timeout(10)
                    ->withHeaders(['User-Agent' => 'MemoriesMap/1.0 (Laravel)'])
                    ->get(self::NOMINATIM_SEARCH_URL, [
                        'q' => $tryQuery,
                        'format' => 'json',
                        'addressdetails' => 1,
                        'limit' => 5, // Get multiple results to find best match
                    ]);

                if (!$response->successful()) {
                    continue;
                }

                $results = $response->json();
                if (empty($results)) {
                    continue;
                }

                // Find best match - prefer exact name matches or buildings
                $bestMatch = $this->selectBestMatch($results, $originalQuery);
                
                if ($bestMatch) {
                    $address = $bestMatch['address'] ?? [];
                    $lat = isset($bestMatch['lat']) ? (float) $bestMatch['lat'] : null;
                    $lon = isset($bestMatch['lon']) ? (float) $bestMatch['lon'] : null;

                    return [
                        'name' => $bestMatch['name'] ?? $this->extractLocationName($bestMatch, $address),
                        'address' => $this->formatAddress($address),
                        'city' => $address['city'] 
                            ?? $address['town'] 
                            ?? $address['village'] 
                            ?? $address['municipality'] 
                            ?? null,
                        'country' => $address['country'] ?? null,
                        'lat' => $lat,
                        'lon' => $lon,
                    ];
                }
            }

            return null;
        } catch (\Throwable $e) {
            \Log::debug('Nominatim geocoding failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Format Photon address components.
     */
    private function formatPhotonAddress(array $props): ?string
    {
        $parts = array_filter([
            $props['housenumber'] ?? null,
            $props['street'] ?? null,
            $props['postcode'] ?? null,
        ]);

        return !empty($parts) ? implode(', ', $parts) : null;
    }

    /**
     * Build query variations to improve search success rate.
     * Nominatim can be picky about query format.
     */
    private function buildQueryVariations(string $query): array
    {
        $variations = [];
        
        // Original query
        $variations[] = $query;
        
        // Try with common country name variations
        $countryReplacements = [
            'United States of America' => 'USA',
            'United States' => 'USA',
            'United Kingdom' => 'UK',
        ];
        
        foreach ($countryReplacements as $long => $short) {
            if (stripos($query, $long) !== false) {
                $variations[] = str_ireplace($long, $short, $query);
            }
        }
        
        // Try without country if query has multiple commas (place, city, country)
        $parts = array_map('trim', explode(',', $query));
        if (count($parts) >= 3) {
            // Try: place, city (without country)
            $variations[] = implode(', ', array_slice($parts, 0, -1));
        }
        
        if (count($parts) >= 2) {
            // Try: place, country (without middle parts)
            $variations[] = $parts[0] . ', ' . end($parts);
        }
        
        // Remove duplicates
        return array_unique($variations);
    }

    /**
     * Select the best match from multiple results.
     * Prioritizes: buildings, amenities, named places over generic addresses.
     */
    private function selectBestMatch(array $results, string $originalQuery): ?array
    {
        if (empty($results)) {
            return null;
        }

        // Extract first part of query (likely the place name)
        $queryParts = array_map('trim', explode(',', $originalQuery));
        $mainSearchTerm = strtolower($queryParts[0] ?? '');

        $scored = [];
        
        foreach ($results as $result) {
            $score = 0;
            $name = strtolower($result['name'] ?? '');
            $displayName = strtolower($result['display_name'] ?? '');
            $type = $result['type'] ?? '';
            $class = $result['class'] ?? '';
            
            // High priority: name matches main search term
            if ($name && str_contains($name, $mainSearchTerm)) {
                $score += 100;
            }
            if ($displayName && str_contains($displayName, $mainSearchTerm)) {
                $score += 50;
            }
            
            // Prefer specific place types
            if (in_array($type, ['building', 'attraction', 'museum', 'hotel', 'restaurant', 'shop', 'office'])) {
                $score += 30;
            }
            if (in_array($class, ['amenity', 'tourism', 'building', 'shop', 'office'])) {
                $score += 20;
            }
            
            // Prefer results with higher importance
            if (isset($result['importance'])) {
                $score += ($result['importance'] * 10);
            }
            
            $scored[] = ['result' => $result, 'score' => $score];
        }
        
        // Sort by score descending
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
        
        return $scored[0]['result'] ?? $results[0];
    }
}
