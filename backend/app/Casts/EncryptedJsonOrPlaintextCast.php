<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Support\Facades\Crypt;

class EncryptedJsonOrPlaintextCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): ?array
    {
        if ($value === null) {
            return null;
        }

        $raw = (string) $value;
        if ($raw === '') {
            return null;
        }

        // First try encrypted payloads.
        try {
            $decrypted = Crypt::decryptString($raw);
            $decoded = json_decode($decrypted, true);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable) {
            // Backward compatibility for legacy plaintext JSON rows.
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : null;
        }
    }

    public function set($model, string $key, $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        $arrayValue = null;

        if (is_array($value)) {
            $arrayValue = $value;
        } elseif (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $arrayValue = $decoded;
            }
        }

        if (!is_array($arrayValue)) {
            return null;
        }

        $json = json_encode($arrayValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \InvalidArgumentException("Unable to JSON encode value for encrypted metadata column [{$key}].");
        }

        return Crypt::encryptString($json);
    }
}
