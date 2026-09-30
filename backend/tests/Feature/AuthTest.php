<?php

namespace Tests\Feature;

use PDO;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_login_succeeds_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'admin123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'definitely-wrong',
        ]);

        $response->assertStatus(422);
    }

    public function test_protected_route_requires_authentication(): void
    {
        $this->getJson('/api/devices')->assertStatus(401);
    }

    public function test_security_headers_are_present(): void
    {
        $response = $this->getJson('/api/health')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer');

        // The API serves only JSON, so it must not be able to load or frame
        // anything at all. This is the mitigation for the dashboard keeping its
        // bearer token in localStorage.
        $csp = (string) $response->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("default-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
    }

    /**
     * The lockout counters live in the cache. On Render the filesystem is
     * ephemeral, so a file cache would be wiped by every deploy and hand an
     * attacker a fresh set of attempts while still looking like it worked.
     */
    public function test_the_default_cache_store_survives_a_restart(): void
    {
        $this->assertNotSame(
            'file',
            config('cache.default'),
            'the default cache store must not be the file store',
        );

        $database = config('cache.stores.database');
        $this->assertSame('database', $database['driver']);
        $this->assertSame('cache', $database['table']);
        $this->assertSame('cache_locks', $database['lock_table']);
    }

    /**
     * Regression: the TLS options have to reach PDO under their real integer
     * keys. array_merge() renumbers integer keys, which quietly turned
     * MYSQL_ATTR_SSL_CA into key 1 and left the connection unencrypted, so
     * TiDB Serverless refused every connection and the deploy could not boot.
     */
    public function test_database_options_keep_their_pdo_keys(): void
    {
        $options = config('database.connections.mysql.options');

        if (extension_loaded('pdo_mysql')) {
            $this->assertArrayHasKey(
                PDO::ATTR_PERSISTENT,
                $options,
                'ATTR_PERSISTENT must be keyed by the constant, not by a renumbered index',
            );
        }

        // Whatever the environment asks for, the keys must be the PDO
        // constants and the set must be dense enough to be read back by name.
        foreach ($options as $key => $value) {
            $this->assertIsInt($key, "PDO option key {$key} must be an integer constant");
            $this->assertNotNull($value, "PDO option {$key} must not be null");
            $this->assertGreaterThan(0, $key, "PDO option key {$key} must not be a renumbered index");
        }
    }

    public function test_sign_in_stamps_last_login_at(): void
    {
        $admin = \App\Models\User::where('email', 'admin@quickwash.hub')->firstOrFail();
        $admin->forceFill(['last_login_at' => null])->save();

        $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'admin123',
        ])->assertStatus(200);

        $this->assertNotNull(
            $admin->fresh()->last_login_at,
            'a successful sign-in must record when it happened',
        );
    }

    public function test_health_endpoint_is_public(): void
    {
        $this->getJson('/api/health')->assertStatus(200)->assertJson(['status' => 'online']);
    }
}
