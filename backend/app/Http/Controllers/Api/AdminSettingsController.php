<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MailSettingsService;
use App\Services\SiteSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class AdminSettingsController extends Controller
{
    private const MAILERS = ['smtp', 'log'];
    private const ENCRYPTIONS = ['tls', 'ssl'];

    public function __construct(
        private readonly SiteSettingsService $siteSettings,
        private readonly MailSettingsService $mailSettings
    ) {}

    public function show(): JsonResponse
    {
        $mail = $this->mailSettings->getCurrentSettings();
        unset($mail['password']);

        return response()->json([
            'site' => $this->siteSettings->getAdminSettingsPayload(),
            'mail' => $mail,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'site.admin_username' => ['required', 'string', 'max:80'],
            'site.admin_password' => ['nullable', 'string', 'min:12', 'max:255'],
            'site.allow_new_user_registration' => ['required', 'boolean'],

            'mail.mailer' => ['required', Rule::in(self::MAILERS)],
            'mail.host' => ['nullable', 'string', 'max:255', 'required_if:mail.mailer,smtp'],
            'mail.port' => ['nullable', 'integer', 'between:1,65535', 'required_if:mail.mailer,smtp'],
            'mail.username' => ['nullable', 'string', 'max:255'],
            'mail.password' => ['nullable', 'string', 'max:1024'],
            'mail.encryption' => ['nullable', Rule::in(self::ENCRYPTIONS)],
            'mail.from_address' => ['required', 'email:rfc,dns', 'max:255'],
            'mail.from_name' => ['required', 'string', 'max:255'],
            'mail.timeout' => ['nullable', 'integer', 'between:1,120'],
            'mail.ehlo_domain' => ['nullable', 'string', 'max:255'],
        ]);

        $sitePayload = $this->siteSettings->updateAdminSettings([
            'admin_username' => $validated['site']['admin_username'],
            'admin_password' => $validated['site']['admin_password'] ?? null,
            'allow_new_user_registration' => $validated['site']['allow_new_user_registration'],
        ]);

        $mailPayload = $this->mailSettings->saveSettings([
            'mailer' => $validated['mail']['mailer'],
            'host' => $validated['mail']['host'] ?? null,
            'port' => $validated['mail']['port'] ?? null,
            'username' => $validated['mail']['username'] ?? null,
            'password' => $validated['mail']['password'] ?? null,
            'encryption' => $validated['mail']['encryption'] ?? null,
            'from_address' => $validated['mail']['from_address'],
            'from_name' => $validated['mail']['from_name'],
            'timeout' => $validated['mail']['timeout'] ?? null,
            'ehlo_domain' => $validated['mail']['ehlo_domain'] ?? null,
        ]);

        return response()->json([
            'site' => $sitePayload,
            'mail' => $mailPayload,
        ]);
    }

    public function sendTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_email' => ['required', 'email:rfc,dns', 'max:255'],
        ]);

        try {
            $this->mailSettings->applyConfiguredMailer();

            Mail::raw('This is a test email from Memories Map admin mail configuration.', function ($message) use ($validated) {
                $message->to($validated['to_email'])
                    ->subject('Memories Map: Admin Mail Configuration Test');
            });

            return response()->json(['message' => 'Test email sent.']);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Test email failed: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function testConnection(): JsonResponse
    {
        $result = $this->mailSettings->testSmtpConnectivity();

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    public function resetMailToEnv(): JsonResponse
    {
        $mailPayload = $this->mailSettings->resetSettingsToEnvDefaults();

        return response()->json([
            'message' => 'Mail settings reset to environment defaults.',
            'mail' => $mailPayload,
        ]);
    }

    public function purgeDatabase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
            'confirmation' => ['required', 'string', 'max:64'],
        ]);

        $adminUsername = $this->siteSettings->getSettings()->admin_username;

        if (! $this->siteSettings->verifyAdminCredentials($adminUsername, $validated['password'])) {
            return response()->json([
                'message' => 'Invalid admin password.',
            ], 422);
        }

        if (trim($validated['confirmation']) !== 'PURGE DATABASE') {
            return response()->json([
                'message' => 'Confirmation text must match "PURGE DATABASE" exactly.',
            ], 422);
        }

        $migrateExit = Artisan::call('migrate:fresh', ['--force' => true]);
        if ($migrateExit !== 0) {
            return response()->json([
                'message' => 'Database purge failed during migrate:fresh.',
                'output' => trim(Artisan::output()),
            ], 500);
        }

        $seedExit = Artisan::call('db:seed', ['--force' => true]);
        if ($seedExit !== 0) {
            return response()->json([
                'message' => 'Database purge failed during db:seed.',
                'output' => trim(Artisan::output()),
            ], 500);
        }

        return response()->json([
            'message' => 'Database was purged and re-initialized successfully.',
        ]);
    }
}
