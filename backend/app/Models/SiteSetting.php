<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_username',
        'admin_password_hash',
        'allow_new_user_registration',
    ];

    protected $casts = [
        'allow_new_user_registration' => 'boolean',
    ];
}
