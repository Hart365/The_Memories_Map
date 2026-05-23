<?php

namespace App\Services;

use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class SiteSettingsService
{
    public const DEFAULT_ADMIN_USERNAME = 'MemoriesAdmin';
    public const DEFAULT_ADMIN_PASSWORD = 'WeC4nRemember!tForYouWh0le$al3';

    public function getSettings(): SiteSetting
    {
        /** @var SiteSetting $settings */
        $settings = Cache::remember('site:settings:v1', now()->addMinutes(10), function () {
            return SiteSetting::query()->firstOrCreate(
                ['id' => 1],
                [
                    'admin_username' => self::DEFAULT_ADMIN_USERNAME,
                    'admin_password_hash' => Hash::make(self::DEFAULT_ADMIN_PASSWORD),
                    'allow_new_user_registration' => true,
                ]
            );
        });

        return $settings;
    }

    public function verifyAdminCredentials(string $username, string $password): bool
    {
        $settings = $this->getSettings();

        return hash_equals($settings->admin_username, $username)
            && Hash::check($password, $settings->admin_password_hash);
    }

    public function getAdminSettingsPayload(): array
    {
        $settings = $this->getSettings();

        return [
            'admin_username' => $settings->admin_username,
            'allow_new_user_registration' => (bool) $settings->allow_new_user_registration,
        ];
    }

    public function updateAdminSettings(array $validated): array
    {
        $settings = $this->getSettings();

        if (array_key_exists('admin_username', $validated)) {
            $settings->admin_username = (string) $validated['admin_username'];
        }

        if (array_key_exists('allow_new_user_registration', $validated)) {
            $settings->allow_new_user_registration = (bool) $validated['allow_new_user_registration'];
        }

        if (! empty($validated['admin_password'])) {
            $settings->admin_password_hash = Hash::make((string) $validated['admin_password']);
        }

        $settings->save();
        Cache::forget('site:settings:v1');

        return $this->getAdminSettingsPayload();
    }

    public function isRegistrationAllowed(): bool
    {
        return (bool) $this->getSettings()->allow_new_user_registration;
    }

    public function getPublicSettingsPayload(): array
    {
        return [
            'allow_new_user_registration' => $this->isRegistrationAllowed(),
        ];
    }
}
