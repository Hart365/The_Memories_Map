<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class MapGuestSchemaFeatureTest extends TestCase
{
    use DatabaseTransactions;

    public function test_map_guest_schema_matches_the_mysql_safe_email_hash_design(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('This regression test validates the live MySQL schema shape.');
        }

        $column = DB::select("SHOW COLUMNS FROM map_guests LIKE 'email'")[0] ?? null;
        $this->assertNotNull($column);
        $this->assertStringStartsWith('text', strtolower((string) $column->Type));

        $indexes = collect(DB::select('SHOW INDEX FROM map_guests'));

        $this->assertTrue($indexes->contains(function (object $index): bool {
            return $index->Key_name === 'map_guests_map_id_index'
                && $index->Column_name === 'map_id';
        }));

        $hashUnique = $indexes
            ->filter(fn (object $index): bool => $index->Key_name === 'map_guests_map_id_email_hash_unique')
            ->sortBy('Seq_in_index')
            ->values();

        $this->assertCount(2, $hashUnique);
        $this->assertSame('map_id', $hashUnique[0]->Column_name);
        $this->assertSame('email_hash', $hashUnique[1]->Column_name);

        $this->assertFalse($indexes->contains(fn (object $index): bool => $index->Key_name === 'map_guests_map_id_email_unique'));
        $this->assertFalse($indexes->contains(function (object $index): bool {
            return $index->Column_name === 'email' && $index->Key_name !== 'PRIMARY';
        }));
    }
}