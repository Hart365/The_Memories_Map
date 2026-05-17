<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeocodingController extends Controller
{
    public function __construct(
        private readonly GeocodingService $geocodingService
    ) {}

    /**
     * Geocode a location query.
     * Supports:
     * - Forward geocoding: "query" parameter (text → coordinates)
     * - Reverse geocoding: "lat" and "lon" parameters (coordinates → text)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function geocode(Request $request): JsonResponse
    {
        error_log('>>> GEOCODING REQUEST: ' . $request->fullUrl());
        error_log('>>> PARAMS: ' . json_encode($request->all()));
        error_log('>>> USER ID: ' . ($request->user()?->id ?? 'none'));
        
        \Log::info('=== GEOCODING REQUEST RECEIVED ===', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'path' => $request->path(),
            'query_params' => $request->query(),
            'has_query' => $request->has('query'),
            'has_lat' => $request->has('lat'),
            'has_lon' => $request->has('lon'),
            'all_params' => $request->all(),
            'user_id' => $request->user()?->id,
            'ip' => $request->ip(),
        ]);
        
        // Forward geocoding (query → coordinates)
        if ($request->has('query')) {
            $query = $request->input('query');
            error_log('>>> FORWARD GEOCODE QUERY: ' . $query);
            \Log::info('Forward geocoding: processing query', ['query' => $query]);
            
            if (empty(trim($query))) {
                \Log::warning('Forward geocoding: empty query');
                return response()->json([
                    'error' => 'Query parameter cannot be empty',
                ], 400);
            }

            $result = $this->geocodingService->forwardGeocode($query);
            
            if (!$result) {
                \Log::warning('Forward geocoding: no results found', ['query' => $query]);
                return response()->json([
                    'error' => 'No results found for this query',
                ], 404);
            }
            
            \Log::info('Forward geocoding: SUCCESS', ['query' => $query, 'result' => $result]);

            return response()->json([
                'location_name' => $result['name'],
                'location_address' => $result['address'],
                'location_city' => $result['city'],
                'location_country' => $result['country'],
                'latitude' => $result['lat'],
                'longitude' => $result['lon'],
            ]);
        }

        // Reverse geocoding (coordinates → text)
        if ($request->has('lat') && $request->has('lon')) {
            $lat = $request->input('lat');
            $lon = $request->input('lon');
            \Log::info('Reverse geocoding: processing coordinates', ['lat' => $lat, 'lon' => $lon]);

            // Validate coordinates
            if (!is_numeric($lat) || !is_numeric($lon)) {
                return response()->json([
                    'error' => 'Invalid coordinates provided',
                ], 400);
            }

            $lat = (float) $lat;
            $lon = (float) $lon;

            if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
                return response()->json([
                    'error' => 'Coordinates out of valid range',
                ], 400);
            }

            $result = $this->geocodingService->reverseGeocode($lat, $lon);
            
            if (!$result) {
                \Log::warning('Reverse geocoding: no results found', ['lat' => $lat, 'lon' => $lon]);
                return response()->json([
                    'error' => 'No location data found for these coordinates',
                ], 404);
            }
            
            \Log::info('Reverse geocoding: SUCCESS', ['lat' => $lat, 'lon' => $lon, 'result' => $result]);

            return response()->json([
                'location_name' => $result['name'],
                'location_address' => $result['address'],
                'location_city' => $result['city'],
                'location_country' => $result['country'],
            ]);
        }

        \Log::warning('Geocoding: missing parameters', [
            'has_query' => $request->has('query'),
            'has_lat' => $request->has('lat'),
            'has_lon' => $request->has('lon'),
            'all_params' => $request->all(),
        ]);
        
        return response()->json([
            'error' => 'Please provide either "query" parameter for forward geocoding or "lat" and "lon" parameters for reverse geocoding',
        ], 400);
    }
}
