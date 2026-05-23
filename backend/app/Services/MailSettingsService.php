<?php

namespace App\Services;

use App\Models\MailSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;

class MailSettingsService
{
    public function getCurrentSettings(): array
    {
        /** @var MailSetting|null $settings */
        $settings = Cache::remember('mail:settings:v1', now()->addMinutes(10), function () {
            return MailSetting::query()->latest('id')->first();
        });

        if (! $settings) {
            return [
                'mailer' => (string) config('mail.default', 'log'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (int) config('mail.mailers.smtp.port'),
                'username' => (string) (config('mail.mailers.smtp.username') ?? ''),
                'password' => null,
                'has_password' => (bool) config('mail.mailers.smtp.password'),
                'encryption' => config('mail.mailers.smtp.scheme') ?: null,
                'from_address' => (string) config('mail.from.address'),
                'from_name' => (string) config('mail.from.name'),
                'timeout' => config('mail.mailers.smtp.timeout'),
                'ehlo_domain' => config('mail.mailers.smtp.local_domain'),
            ];
        }

        return [
            'mailer' => $settings->mailer,
            'host' => $settings->host,
            'port' => $settings->port,
            'username' => $settings->username,
            'password' => $settings->password_encrypted ? Crypt::decryptString($settings->password_encrypted) : null,
            'has_password' => (bool) $settings->password_encrypted,
            'encryption' => $settings->encryption,
            'from_address' => $settings->from_address,
            'from_name' => $settings->from_name,
            'timeout' => $settings->timeout,
            'ehlo_domain' => $settings->ehlo_domain,
        ];
    }

    public function saveSettings(array $validated): array
    {
        $current = MailSetting::query()->latest('id')->first();

        $passwordEncrypted = $current?->password_encrypted;
        if (array_key_exists('password', $validated)) {
            if ($validated['password'] === null || $validated['password'] === '') {
                $passwordEncrypted = null;
            } else {
                $passwordEncrypted = Crypt::encryptString((string) $validated['password']);
            }
        }

        $settings = MailSetting::query()->updateOrCreate(
            ['id' => $current?->id ?? 1],
            [
                'mailer' => $validated['mailer'],
                'host' => $validated['mailer'] === 'smtp' ? ($validated['host'] ?? null) : null,
                'port' => $validated['mailer'] === 'smtp' ? ($validated['port'] ?? null) : null,
                'username' => $validated['mailer'] === 'smtp' ? ($validated['username'] ?? null) : null,
                'password_encrypted' => $validated['mailer'] === 'smtp' ? $passwordEncrypted : null,
                'encryption' => $validated['mailer'] === 'smtp' ? ($validated['encryption'] ?? null) : null,
                'from_address' => $validated['from_address'] ?? null,
                'from_name' => $validated['from_name'] ?? null,
                'timeout' => $validated['mailer'] === 'smtp' ? ($validated['timeout'] ?? null) : null,
                'ehlo_domain' => $validated['mailer'] === 'smtp' ? ($validated['ehlo_domain'] ?? null) : null,
            ]
        );

        Cache::forget('mail:settings:v1');

        return [
            'id' => $settings->id,
            'mailer' => $settings->mailer,
            'host' => $settings->host,
            'port' => $settings->port,
            'username' => $settings->username,
            'has_password' => (bool) $settings->password_encrypted,
            'encryption' => $settings->encryption,
            'from_address' => $settings->from_address,
            'from_name' => $settings->from_name,
            'timeout' => $settings->timeout,
            'ehlo_domain' => $settings->ehlo_domain,
        ];
    }

    public function resetSettingsToEnvDefaults(): array
    {
        $defaultMailer = (string) config('mail.default', 'log');
        $smtpPassword = config('mail.mailers.smtp.password');

        $settings = MailSetting::query()->updateOrCreate(
            ['id' => 1],
            [
                'mailer' => in_array($defaultMailer, ['smtp', 'log'], true) ? $defaultMailer : 'log',
                'host' => config('mail.mailers.smtp.host'),
                'port' => config('mail.mailers.smtp.port'),
                'username' => config('mail.mailers.smtp.username'),
                'password_encrypted' => $smtpPassword ? Crypt::encryptString((string) $smtpPassword) : null,
                'encryption' => config('mail.mailers.smtp.scheme') ?: null,
                'from_address' => config('mail.from.address'),
                'from_name' => config('mail.from.name'),
                'timeout' => config('mail.mailers.smtp.timeout'),
                'ehlo_domain' => config('mail.mailers.smtp.local_domain'),
            ]
        );

        Cache::forget('mail:settings:v1');

        return [
            'id' => $settings->id,
            'mailer' => $settings->mailer,
            'host' => $settings->host,
            'port' => $settings->port,
            'username' => $settings->username,
            'has_password' => (bool) $settings->password_encrypted,
            'encryption' => $settings->encryption,
            'from_address' => $settings->from_address,
            'from_name' => $settings->from_name,
            'timeout' => $settings->timeout,
            'ehlo_domain' => $settings->ehlo_domain,
        ];
    }

    public function testSmtpConnectivity(): array
    {
        $settings = $this->getCurrentSettings();

        if ($settings['mailer'] !== 'smtp') {
            return [
                'ok' => true,
                'message' => 'Connectivity check skipped because current mailer is not SMTP.',
            ];
        }

        $host = (string) ($settings['host'] ?? '');
        $port = (int) ($settings['port'] ?? 0);
        if ($host === '' || $port < 1) {
            return [
                'ok' => false,
                'message' => 'SMTP host or port is not configured.',
            ];
        }

        $timeout = (int) ($settings['timeout'] ?? 10);
        if ($timeout < 1) {
            $timeout = 10;
        }

        $schemePrefix = ($settings['encryption'] ?? null) === 'ssl' ? 'ssl://' : '';
        $target = sprintf('%s%s:%d', $schemePrefix, $host, $port);

        $errno = 0;
        $errstr = '';
        $connection = @stream_socket_client($target, $errno, $errstr, $timeout);

        if (! $connection) {
            return [
                'ok' => false,
                'message' => sprintf('Unable to connect to SMTP server (%s).', $errstr ?: 'unknown error'),
            ];
        }

        fclose($connection);

        return [
            'ok' => true,
            'message' => 'Successfully connected to SMTP server.',
        ];
    }

    public function applyConfiguredMailer(): void
    {
        $settings = $this->getCurrentSettings();

        Config::set('mail.default', $settings['mailer']);

        if ($settings['mailer'] === 'smtp') {
            Config::set('mail.mailers.smtp.transport', 'smtp');
            Config::set('mail.mailers.smtp.host', $settings['host']);
            Config::set('mail.mailers.smtp.port', $settings['port']);
            Config::set('mail.mailers.smtp.username', $settings['username']);
            Config::set('mail.mailers.smtp.password', $settings['password']);
            Config::set('mail.mailers.smtp.scheme', $settings['encryption']);
            Config::set('mail.mailers.smtp.timeout', $settings['timeout']);
            Config::set('mail.mailers.smtp.local_domain', $settings['ehlo_domain']);
        }

        if (! empty($settings['from_address'])) {
            Config::set('mail.from.address', $settings['from_address']);
        }

        if (! empty($settings['from_name'])) {
            Config::set('mail.from.name', $settings['from_name']);
        }

        $mailManager = app('mail.manager');
        if (method_exists($mailManager, 'forgetMailers')) {
            $mailManager->forgetMailers();
        }
    }
}
