<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Create a test user
$user = \App\Models\User::updateOrCreate(
    ['email' => 'test@test.com'],
    [
        'name' => 'Test User',
        'password' => \Illuminate\Support\Facades\Hash::make('password'),
    ]
);

echo "✅ User created/updated:\n";
echo "Email: test@test.com\n";
echo "Password: password\n";
echo "User ID: {$user->id}\n";
