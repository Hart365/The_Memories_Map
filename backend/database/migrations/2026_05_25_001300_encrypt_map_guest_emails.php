<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('map_guests', 'email_hash')) {
            Schema::table('map_guests', function (Blueprint $table) {
                $table->string('email_hash', 64)->nullable()->after('email');
            });
        }

        if (DB::getDriverName() === 'mysql') {
            if (!$this->indexExists('map_guests', 'map_guests_map_id_index')) {
                Schema::table('map_guests', function (Blueprint $table) {
                    $table->index('map_id', 'map_guests_map_id_index');
                });
            }

            if ($this->columnType('map_guests', 'email') !== 'text') {
                if ($this->indexExists('map_guests', 'map_guests_map_id_email_unique')) {
                    DB::statement('ALTER TABLE map_guests DROP INDEX map_guests_map_id_email_unique, MODIFY email TEXT NOT NULL');
                } else {
                    $this->dropMysqlIndexesReferencingColumn('map_guests', 'email');
                    DB::statement('ALTER TABLE map_guests MODIFY email TEXT NOT NULL');
                }
            }
        }

        DB::table('map_guests')
            ->select(['id', 'email', 'email_hash'])
            ->orderBy('id')
            ->chunkById(250, function ($rows): void {
                foreach ($rows as $row) {
                    $value = $row->email;
                    if ($value === null) {
                        continue;
                    }

                    $raw = (string) $value;
                    if ($raw === '') {
                        continue;
                    }

                    $plainEmail = $this->decryptIfEncrypted($raw) ?? $raw;
                    $normalizedEmail = strtolower(trim($plainEmail));
                    if ($normalizedEmail === '') {
                        continue;
                    }

                    $hash = hash('sha256', $normalizedEmail);
                    $updates = [];

                    if ($row->email_hash !== $hash) {
                        $updates['email_hash'] = $hash;
                    }

                    if (!$this->isEncrypted($raw)) {
                        $updates['email'] = Crypt::encryptString($normalizedEmail);
                    }

                    if (!empty($updates)) {
                        DB::table('map_guests')
                            ->where('id', $row->id)
                            ->update($updates);
                    }
                }
            });

        if (!$this->indexExists('map_guests', 'map_guests_map_id_email_hash_unique')) {
            Schema::table('map_guests', function (Blueprint $table) {
                $table->unique(['map_id', 'email_hash'], 'map_guests_map_id_email_hash_unique');
            });
        }
    }

    public function down(): void
    {
        // Irreversible by design.
    }

    private function decryptIfEncrypted(string $value): ?string
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function isEncrypted(string $value): bool
    {
        return $this->decryptIfEncrypted($value) !== null;
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            $rows = DB::select('SHOW INDEX FROM ' . $table . ' WHERE Key_name = ?', [$index]);
            return !empty($rows);
        }

        return false;
    }

    private function columnType(string $table, string $column): ?string
    {
        if (DB::getDriverName() !== 'mysql') {
            return null;
        }

        $database = DB::getDatabaseName();
        $rows = DB::select(
            'SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            [$database, $table, $column]
        );

        return $rows[0]->DATA_TYPE ?? null;
    }

    private function dropMysqlIndexesReferencingColumn(string $table, string $column): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $rows = DB::select('SHOW INDEX FROM ' . $table);
        $indexNames = [];

        foreach ($rows as $row) {
            $columnName = $row->Column_name ?? null;
            $keyName = $row->Key_name ?? null;

            if ($columnName === $column && $keyName !== null && $keyName !== 'PRIMARY') {
                $indexNames[] = $keyName;
            }
        }

        foreach (array_values(array_unique($indexNames)) as $indexName) {
            try {
                DB::statement(sprintf('ALTER TABLE %s DROP INDEX %s', $table, $indexName));
            } catch (\Throwable) {
                // Index may already be absent or dropped by another migration step.
            }
        }
    }
};
