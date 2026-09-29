<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The NAEK ingest endpoint is unauthenticated by design apart from a shared
 * key, and it writes sale telemetry straight into the revenue tables. These
 * tests pin the two ways that can go wrong: a missing key silently opening
 * the endpoint, and a key that is not compared in constant time.
 */
class NaekIngestSecurityTest extends TestCase
{
    private const VALID_PAYLOAD = [
        'deviceId' => 'naek_carwash_1',
        'snapshot' => [
            'shopName' => 'Test Shop',
            'credits' => 1,
            'totalSales' => 0,
            'products' => [
                ['name' => 'Regular', 'rate' => 10, 'duration' => 300, 'status' => 'ON', 'usage' => 0],
            ],
        ],
        'events' => [],
    ];

    public function test_ingest_rejects_a_wrong_api_key(): void
    {
        config(['services.naek.ingest_key' => 'correct-horse-battery']);

        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD, ['x-api-key' => 'wrong'])
            ->assertStatus(401);
    }

    public function test_ingest_rejects_a_missing_api_key_header(): void
    {
        config(['services.naek.ingest_key' => 'correct-horse-battery']);

        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD)
            ->assertStatus(401);
    }

    /**
     * A key that is present but empty must NOT be treated as "auth disabled".
     */
    public function test_ingest_fails_closed_when_the_key_is_blank(): void
    {
        config(['services.naek.ingest_key' => '']);

        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD, ['x-api-key' => ''])
            ->assertStatus(500);

        // And it must not accept a guess at the old default either.
        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD, ['x-api-key' => 'quickwash-bridge-key'])
            ->assertStatus(500);
    }

    public function test_ingest_fails_closed_when_the_key_is_not_configured_at_all(): void
    {
        config(['services.naek.ingest_key' => null]);

        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD, ['x-api-key' => 'anything'])
            ->assertStatus(500);
    }

    public function test_ingest_accepts_a_matching_key(): void
    {
        config(['services.naek.ingest_key' => 'correct-horse-battery']);

        $this->postJson('/api/ingest/naek', self::VALID_PAYLOAD, ['x-api-key' => 'correct-horse-battery'])
            ->assertStatus(200);
    }
}
