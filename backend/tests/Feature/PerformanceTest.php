<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Hash;
use PDO;
use Tests\TestCase;

class PerformanceTest extends TestCase
{
    /**
     * Regression for the deploy that went down: the TLS options were combined
     * with array_merge(), which renumbers integer keys, so
     * PDO::MYSQL_ATTR_SSL_CA arrived as key 1 and PDO could not read it. TiDB
     * refuses unencrypted connections, so nothing could boot.
     */
    public function test_pdo_options_keep_their_real_keys(): void
    {
        $options = config('database.connections.mysql.options');

        $this->assertArrayHasKey(
            PDO::ATTR_PERSISTENT,
            $options,
            'ATTR_PERSISTENT must be keyed by the constant, not renumbered by array_merge',
        );
        $this->assertTrue($options[PDO::ATTR_PERSISTENT], 'persistent connections are on by default');

        foreach ($options as $key => $value) {
            $this->assertIsInt($key, "PDO option key {$key} must be an integer constant");
            $this->assertGreaterThan(0, $key, "PDO option key {$key} looks renumbered");
            $this->assertNotNull($value);
        }
    }

    public function test_persistent_connections_can_be_turned_off(): void
    {
        // The escape hatch matters more than the default: if a deployment ever
        // misbehaves with them, one env var must be able to revert this
        // without a deploy.
        putenv('DB_PERSISTENT=0');
        $options = require base_path('config/database.php');

        $this->assertArrayHasKey(PDO::ATTR_PERSISTENT, $options['connections']['mysql']['options']);
        $this->assertFalse(
            $options['connections']['mysql']['options'][PDO::ATTR_PERSISTENT],
            'DB_PERSISTENT=false must disable persistent connections',
        );

        putenv('DB_PERSISTENT');
    }

/**
     * phpunit.xml sets BCRYPT_ROUNDS=4 to keep the suite fast, so the resolved
 * value during a test is the test override and not the shipped default. All
 * three sources Laravel reads have to be cleared, not just the process env.
 */
private function configWithRoundsCleared()
{
    $previous = $_ENV['BCRYPT_ROUNDS'] ?? null;

    putenv('BCRYPT_ROUNDS');
    unset($_ENV['BCRYPT_ROUNDS'], $_SERVER['BCRYPT_ROUNDS']);

    try {
        return require base_path('config/hashing.php');
    } finally {
        if ($previous !== null) {
            putenv("BCRYPT_ROUNDS={$previous}");
            $_ENV['BCRYPT_ROUNDS'] = $previous;
        }
    }
}

/**
 * A sign-in took about 6.7s in production while a request that skipped
 * bcrypt took 28ms, so the hashing cost was almost all of it. Cost 12 on
 * a 0.1 CPU instance costs roughly three times the wait of cost 10.
 */
public function test_password_hashing_defaults_to_the_cheaper_cost(): void
{
    $hashing = $this->configWithRoundsCleared();

    $this->assertSame(10, $hashing['bcrypt']['rounds'], 'the shipped default should be 10 on this hardware');
    $this->assertGreaterThanOrEqual(10, $hashing['bcrypt']['rounds'], 'never below the OWASP recommended minimum');
    $this->assertTrue($hashing['bcrypt']['verify'], 'verify stays on or a tampered hash would be accepted');
    $this->assertTrue($hashing['rehash_on_login'], 'existing hashes get upgraded on the next sign-in');
}

public function test_the_rounds_default_still_honours_the_environment(): void
{
    putenv('BCRYPT_ROUNDS=12');
    $_ENV['BCRYPT_ROUNDS'] = '12';
    try {
        $hashing = require base_path('config/hashing.php');
        $this->assertSame(12, $hashing['bcrypt']['rounds'], 'the env var must be able to raise it back');
    } finally {
        putenv('BCRYPT_ROUNDS');
        $_ENV['BCRYPT_ROUNDS'] = '4';
    }
}

    public function test_passwords_are_still_hashed_and_verified(): void
    {
        $hash = Hash::make('correct-horse-battery');

        $this->assertTrue(Hash::check('correct-horse-battery', $hash));
        $this->assertFalse(Hash::check('wrong', $hash));

        // Cost is baked into the hash, so a lower default does not stop
        // verifying hashes that were created at the old cost.
        $previous = Hash::make('legacy-password', ['rounds' => 12]);
        $this->assertTrue(Hash::check('legacy-password', $previous));
    }
}