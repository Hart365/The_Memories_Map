<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    private const ALLOWED_DATE_FORMATS = [
        'YYYY-MM-DD',
        'DD/MM/YY',
        'MM/DD/YY',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
    ];

        public function timezones(): JsonResponse
        {
            $timezones = Cache::remember('profile:timezones:v1', now()->addHours(12), function () {
                $nowUtc = new DateTimeImmutable('now', new DateTimeZone('UTC'));
                $items = [];

                foreach (DateTimeZone::listIdentifiers() as $identifier) {
                    $tz = new DateTimeZone($identifier);
                    $offsetSeconds = $tz->getOffset($nowUtc);
                    $items[] = [
                        'value' => $identifier,
                        'location' => $this->formatLocation($identifier),
                        'utc_offset' => $this->formatUtcOffset($offsetSeconds),
                        'offset_seconds' => $offsetSeconds,
                    ];
                }

                usort($items, function (array $a, array $b) {
                    if ($a['offset_seconds'] === $b['offset_seconds']) {
                        return strcmp($a['location'], $b['location']);
                    }
                    return $a['offset_seconds'] <=> $b['offset_seconds'];
                });

                return array_map(function (array $item) {
                    return [
                        'value' => $item['value'],
                        'location' => $item['location'],
                        'utc_offset' => $item['utc_offset'],
                        'label' => $item['location'] . ' (' . $item['utc_offset'] . ')',
                    ];
                }, $items);
            });

            return response()->json(['data' => $timezones]);
        }

    use AuthorizesRequests;

    public function show(Request $request): JsonResponse
    {
        return response()->json($request->user()->only('id', 'name', 'email', 'default_timezone', 'date_format', 'created_at'));
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'  => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email:rfc,dns', 'max:255', 'unique:users,email,' . $request->user()->id],
            'default_timezone' => ['sometimes', 'timezone'],
            'date_format' => ['sometimes', 'string', Rule::in(self::ALLOWED_DATE_FORMATS)],
        ]);

        $request->user()->update($validated);

        return response()->json($request->user()->fresh()->only('id', 'name', 'email', 'default_timezone', 'date_format', 'created_at'));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string', 'current_password'],
            'password'         => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $request->user()->update([
            'password' => Hash::make($request->password),
        ]);

        // Revoke all existing tokens
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Password changed. Please log in again.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'current_password'],
        ]);

        $request->user()->delete();

        return response()->json(null, 204);
    }

    private function formatUtcOffset(int $offsetSeconds): string
    {
        $sign = $offsetSeconds >= 0 ? '+' : '-';
        $totalMinutes = abs((int) floor($offsetSeconds / 60));
        $hours = (int) floor($totalMinutes / 60);
        $minutes = $totalMinutes % 60;

        return sprintf('UTC%s%02d:%02d', $sign, $hours, $minutes);
    }

    private function formatLocation(string $identifier): string
    {
        $parts = array_map(
            fn (string $part) => str_replace('_', ' ', $part),
            explode('/', $identifier)
        );

        if (count($parts) === 1) {
            return $parts[0] . ' - ' . $identifier;
        }

        return implode(' / ', $parts) . ' - ' . $identifier;
    }
}
