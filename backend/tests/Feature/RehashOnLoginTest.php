<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The hashing cost is baked into a stored hash, so lowering the configured
 * cost changes nothing for passwords that were already set. rehash_on_login
 * does not cover this login path: that hook belongs to Laravel's session
 * guard, and sign-in here is a Sanctum token issued by a controller.
 */
class RehashOnLoginTest extends TestCase
{
    public function test_signing_in_rehashes_a_password_stored_at_the_old_cost(): void
    {
        $user = new User();
        $user->forceFill([
            'username' => 'rehash_' . uniqid(),
            'full_name' => 'Rehash Tester',
            'email' => 'rehash_' . uniqid() . '@example.com',
            // A hash written before the cost was lowered.
            'password_hash' => Hash::make('password123', ['rounds' => 12]),
            'role' => 'admin',
            'facility_id' => 1,
        ])->save();

        $before = $user->password_hash;
        $this->assertStringContainsString('$12$', $before, 'fixture should be stored at the old cost');

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);

        $after = $user->fresh()->password_hash;
        $this->assertStringNotContainsString('$12$', $after, 'the hash should be upgraded on sign-in');
        $this->assertSame(config('hashing.bcrypt.rounds'), costOf($after));

        // The new hash must still verify, and the old password must not change.
        $this->assertTrue(Hash::check('password123', $after));

        $user->delete();
    }

    public function test_a_password_already_at_the_current_cost_is_left_alone(): void
    {
        $user = new User();
        $user->forceFill([
            'username' => 'norh_' . uniqid(),
            'full_name' => 'No Rehash',
            'email' => 'norh_' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123', ['rounds' => config('hashing.bcrypt.rounds')]),
            'role' => 'admin',
            'facility_id' => 1,
        ])->save();

        $before = $user->password_hash;

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ])->assertStatus(200);

        // Rewriting an unchanged password on every sign-in would be pointless
        // database work on the hot path.
        $this->assertSame($before, $user->fresh()->password_hash);

        $user->delete();
    }

    public function test_signing_in_still_succeeds_after_a_rehash(): void
    {
        $user = new User();
        $user->forceFill([
            'username' => 'post_' . uniqid(),
            'full_name' => 'After Rehash',
            'email' => 'post_' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123', ['rounds' => 12]),
            'role' => 'admin',
            'facility_id' => 1,
        ])->save();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123'])
            ->assertStatus(200);

        // The token issued on that request must still work.
        $token = json_decode(
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123'])->getContent(),
            true
        )['token'];

        $this->withToken($token)->getJson('/api/auth/user')->assertStatus(200);

        $user->delete();
    }
}

/** Reads the cost out of a bcrypt hash, which is stored as $rounds$. */
function costOf(string $hash): int
{
    return (int) explode('$', $hash)[2];
}