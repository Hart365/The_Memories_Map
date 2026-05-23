<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MailSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'mailer',
        'host',
        'port',
        'username',
        'password_encrypted',
        'encryption',
        'from_address',
        'from_name',
        'timeout',
        'ehlo_domain',
    ];
}
