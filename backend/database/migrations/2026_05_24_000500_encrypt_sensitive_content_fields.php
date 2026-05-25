<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE memories_maps MODIFY name TEXT NOT NULL');
            DB::statement('ALTER TABLE map_notes MODIFY title TEXT NULL');

            DB::statement('ALTER TABLE media_files MODIFY original_name TEXT NOT NULL');
            DB::statement('ALTER TABLE media_files MODIFY camera_make TEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY camera_model TEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY location_name TEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY location_address TEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY location_city TEXT NULL');
            DB::statement('ALTER TABLE media_files MODIFY location_country TEXT NULL');
        }

        $this->encryptTableColumns('memories_maps', [
            'name',
            'description',
        ]);

        $this->encryptTableColumns('map_notes', [
            'title',
            'body',
        ]);

        $this->encryptTableColumns('media_files', [
            'original_name',
            'camera_make',
            'camera_model',
            'location_name',
            'location_address',
            'location_city',
            'location_country',
            'user_caption',
        ]);
    }

    public function down(): void
    {
        // Irreversible data migration; intentionally left blank.
    }

    private function encryptTableColumns(string $table, array $columns): void
    {
        DB::table($table)
            ->select(array_merge(['id'], $columns))
            ->orderBy('id')
            ->chunkById(250, function ($rows) use ($table, $columns): void {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach ($columns as $column) {
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

                        $updates[$column] = Crypt::encryptString($raw);
                    }

                    if (!empty($updates)) {
                        DB::table($table)
                            ->where('id', $row->id)
                            ->update($updates);
                    }
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
