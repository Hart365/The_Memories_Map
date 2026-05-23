<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MailSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class MailSettingsController extends Controller
{
    private const MAILERS = ['smtp', 'log'];
    private const ENCRYPTIONS = ['tls', 'ssl'];

    public function __construct(private readonly MailSettingsService $mailSettings) {}

    public function show(): JsonResponse
    {
        $settings = $this->mailSettings->getCurrentSettings();

        unset($settings['password']);

        return response()->json($settings);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mailer' => ['required', Rule::in(self::MAILERS)],
            'host' => ['nullable', 'string', 'max:255', 'required_if:mailer,smtp'],
            'port' => ['nullable', 'integer', 'between:1,65535', 'required_if:mailer,smtp'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:1024'],
            'encryption' => ['nullable', Rule::in(self::ENCRYPTIONS)],
            'from_address' => ['required', 'email:rfc,dns', 'max:255'],
            'from_name' => ['required', 'string', 'max:255'],
            'timeout' => ['nullable', 'integer', 'between:1,120'],
            'ehlo_domain' => ['nullable', 'string', 'max:255'],
        ]);

        $settings = $this->mailSettings->saveSettings($validated);

        return response()->json($settings);
    }

    public function sendTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_email' => ['required', 'email:rfc,dns', 'max:255'],
        ]);

        $this->mailSettings->applyConfiguredMailer();

        Mail::raw('This is a test email from Memories Map mail configuration.', function ($message) use ($validated) {
            $message->to($validated['to_email'])
                ->subject('Memories Map: Mail Configuration Test');
        });

        return response()->json(['message' => 'Test email sent.']);
    }
}
