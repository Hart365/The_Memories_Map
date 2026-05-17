<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TimezoneService
{
    /**
     * Get timezone information from coordinates.
     * Returns timezone identifier (e.g., 'America/New_York') and offset in minutes.
     */
    public function getTimezoneFromCoordinates(float $latitude, float $longitude): ?array
    {
        $cacheKey = "timezone:{$latitude}:{$longitude}";
        
        // Cache timezone lookups for 90 days (they don't change)
        return Cache::remember($cacheKey, now()->addDays(90), function () use ($latitude, $longitude) {
            // Try multiple providers in sequence
            $timezone = $this->tryTimeApiIo($latitude, $longitude)
                     ?? $this->tryGeoNamesOrg($latitude, $longitude);
            
            if ($timezone) {
                Log::info('Timezone lookup successful', [
                    'lat' => $latitude,
                    'lon' => $longitude,
                    'timezone' => $timezone['timezone'],
                    'offset' => $timezone['offset'],
                ]);
            } else {
                Log::warning('Timezone lookup failed', [
                    'lat' => $latitude,
                    'lon' => $longitude,
                ]);
            }
            
            return $timezone;
        });
    }

    /**
     * TimeAPI.io - Free, no API key required
     * https://timeapi.io/swagger/index.html
     */
    private function tryTimeApiIo(float $lat, float $lon): ?array
    {
        try {
            $response = Http::timeout(10)
                ->get('https://timeapi.io/api/TimeZone/coordinate', [
                    'latitude' => $lat,
                    'longitude' => $lon,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (isset($data['timeZone'])) {
                    return [
                        'timezone' => $data['timeZone'],
                        'offset' => $this->calculateOffsetMinutes($data),
                    ];
                }
            }
        } catch (\Exception $e) {
            Log::debug('TimeAPI.io failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * GeoNames.org timezone API - Free but requires username
     * Fallback option if TimeAPI fails
     */
    private function tryGeoNamesOrg(float $lat, float $lon): ?array
    {
        // GeoNames requires a username - skip if not configured
        $username = config('services.geonames.username');
        if (!$username) {
            return null;
        }

        try {
            $response = Http::timeout(10)
                ->get('http://api.geonames.org/timezoneJSON', [
                    'lat' => $lat,
                    'lng' => $lon,
                    'username' => $username,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (isset($data['timezoneId'])) {
                    return [
                        'timezone' => $data['timezoneId'],
                        'offset' => ($data['rawOffset'] ?? 0) * 60, // Convert hours to minutes
                    ];
                }
            }
        } catch (\Exception $e) {
            Log::debug('GeoNames timezone failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Calculate offset in minutes from TimeAPI.io response
     */
    private function calculateOffsetMinutes(array $data): int
    {
        // TimeAPI returns currentUtcOffset like "+01:00" or "-05:00"
        if (isset($data['currentUtcOffset']['seconds'])) {
            return (int) ($data['currentUtcOffset']['seconds'] / 60);
        }
        
        // Try to parse from string format
        if (isset($data['standardUtcOffset']['offsetString'])) {
            $offset = $data['standardUtcOffset']['offsetString'];
            if (preg_match('/([+-])(\d{2}):(\d{2})/', $offset, $matches)) {
                $sign = $matches[1] === '+' ? 1 : -1;
                $hours = (int) $matches[2];
                $minutes = (int) $matches[3];
                return $sign * ($hours * 60 + $minutes);
            }
        }

        return 0;
    }

    /**
     * Convert UTC datetime to local time using timezone identifier
     */
    public function convertToLocalTime(\DateTime $utcTime, string $timezone): ?\DateTime
    {
        try {
            $localTime = clone $utcTime;
            $localTime->setTimezone(new \DateTimeZone($timezone));
            return $localTime;
        } catch (\Exception $e) {
            Log::error('Failed to convert to local time', [
                'timezone' => $timezone,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Calculate local time from UTC and offset in minutes
     */
    public function applyOffsetToUtcTime(\DateTime $utcTime, int $offsetMinutes): \DateTime
    {
        $localTime = clone $utcTime;
        $localTime->modify(($offsetMinutes >= 0 ? '+' : '') . $offsetMinutes . ' minutes');
        return $localTime;
    }
}
