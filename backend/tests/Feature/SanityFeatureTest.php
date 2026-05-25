<?php

declare(strict_types=1);

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;

final class SanityFeatureTest extends TestCase
{
    public function test_basic_feature_smoke(): void
    {
        $this->assertSame(2, 1 + 1);
    }
}
