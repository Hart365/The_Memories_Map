<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media_files MODIFY exif_json LONGTEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY user_tags LONGTEXT NULL');
        }

        $this->encryptJsonColumn('media_files', 'exif_json');
        $this->encryptJsonColumn('media_files', 'user_tags');
    }

    public function down(): void
    {
        // Irreversible by design.
    }

    private function encryptJsonColumn(string $table, string $column): void
    {
        DB::table($table)
            ->select(['id', $column])
            ->orderBy('id')
            ->chunkById(250, function ($rows) use ($table, $column): void {
                foreach ($rows as $row) {
                    $value = $row->{$column};
                    if ($value === null) {
                        continue;
                    }

                    $raw = (string) $value;
                    if ($raw === '') {
                        continue;
                    }

                    if ($this->isEncrypted($raw)) {
                        continue;
                    }

                    DB::table($table)
                        ->where('id', $row->id)
                        ->update([
                            $column => Crypt::encryptString($raw),
                        ]);
                }
            });
    }

    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
};
