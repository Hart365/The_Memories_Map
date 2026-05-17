<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Reset password for mike@hart365.co.uk to "password"
$user = \App\Models\User::where('email', 'mike@hart365.co.uk')->first();

if ($user) {
    $user->password = bcrypt('password');
    $user->save();
    echo "✅ Password reset for {$user->email} (ID: {$user->id})\n";
    echo "Email: mike@hart365.co.uk\n";
    echo "Password: password\n\n";
    
    // Show their maps
    $maps = \App\Models\MemoriesMap::where('user_id', $user->id)->get();
    echo "Maps owned by this user:\n";
    foreach ($maps as $map) {
        $mediaCount = \App\Models\MediaFile::where('map_id', $map->id)->count();
        echo "  - Map ID {$map->id}: {$map->title} ({$mediaCount} media files)\n";
    }
} else {
    echo "❌ User not found\n";
}
