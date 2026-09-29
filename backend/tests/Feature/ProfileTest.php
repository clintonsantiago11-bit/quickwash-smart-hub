<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    private function makeUser(string $role = 'manager'): User
    {
        $user = new User();

        // forceFill, not create(): role, username and password_hash are not
        // mass-assignable, which is the point — a test fixture setting them
        // has to say so explicitly, the same way a real admin flow would.
        $user->forceFill([
            'username' => 'prof_' . uniqid(),
            'full_name' => 'Profile Tester',
            'email' => 'prof_' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123'),
            'role' => $role,
            'facility_id' => 1,
        ])->save();

        return $user;
    }

    public function test_profile_show_serialises_dates_and_booleans_for_the_client(): void
    {
        // Regression: last_login_at came back as a raw string because the model
        // had no casts, and the DTO then called toIso8601String() on it, which
        // made every /profile response a 500.
        $user = $this->makeUser();
        $user->forceFill([
            'last_login_at' => now(),
            'is_dark_mode' => false,
            'email_alerts' => true,
        ])->save();

        $body = $this->asToken($user->createToken('t')->plainTextToken)
            ->getJson('/api/profile')
            ->assertStatus(200)
            ->assertJsonPath('is_dark_mode', false)
            ->assertJsonPath('email_alerts', true)
            ->json();

        $this->assertIsString($body['last_login_at'], 'last_login_at must serialise as an ISO string');
        $this->assertNotFalse(
            strtotime($body['last_login_at']),
            'last_login_at must be a parseable timestamp',
        );
        $this->assertIsString($body['created_at']);

        $user->delete();
    }

    public function test_profile_show_never_exposes_the_password_hash(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->getJson('/api/profile')
            ->assertStatus(200)
            ->assertJsonStructure([
                'id', 'full_name', 'email', 'role', 'facility_id',
                'is_dark_mode', 'email_alerts', 'timezone', 'locale',
            ])
            ->assertJsonMissingPath('password_hash')
            ->assertJsonMissingPath('remember_token');

        $user->delete();
    }

    public function test_profile_update_rejects_an_email_already_used_by_another_account(): void
    {
        $one = $this->makeUser();
        $two = $this->makeUser();

        $this->asToken($two->createToken('t')->plainTextToken)
            ->putJson('/api/profile', [
                'full_name' => 'Taken',
                'email' => $one->email,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $one->delete();
        $two->delete();
    }

    public function test_profile_update_rejects_a_malformed_email(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile', [
                'full_name' => 'Valid Name',
                'email' => 'not-an-email',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $user->delete();
    }

    public function test_profile_update_allows_saving_the_same_email_unchanged(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile', [
                'full_name' => 'Renamed Self',
                'email' => $user->email,
            ])
            ->assertStatus(200)
            ->assertJsonPath('user.full_name', 'Renamed Self');

        $user->delete();
    }

    public function test_profile_update_cannot_escalate_role_or_facility(): void
    {
        $user = $this->makeUser('technician');

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile', [
                'full_name' => 'Escalation Attempt',
                'email' => $user->email,
                'role' => 'admin',
                'facility_id' => 99,
            ])
            ->assertStatus(200);

        $user->refresh();
        $this->assertSame('technician', $user->role, 'role must not be settable through the profile');
        $this->assertSame(1, (int) $user->facility_id, 'facility must not be settable through the profile');

        $user->delete();
    }

    public function test_profile_update_rejects_a_rubbish_phone_number(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile', [
                'full_name' => 'Valid Name',
                'email' => $user->email,
                'phone' => 'call me maybe<script>',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        $user->delete();
    }

    public function test_change_password_requires_the_current_password(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile/password', [
                'current_password' => 'not-the-password',
                'password' => 'BrandNewPass1',
                'password_confirmation' => 'BrandNewPass1',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('password123', $user->fresh()->password_hash));
        $user->delete();
    }

    public function test_change_password_rejects_a_weak_password(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile/password', [
                'current_password' => 'password123',
                'password' => 'alllowercase',
                'password_confirmation' => 'alllowercase',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $user->delete();
    }

    public function test_change_password_revokes_other_sessions_but_keeps_the_caller(): void
    {
        $user = $this->makeUser();
        $currentToken = $user->createToken('current')->plainTextToken;
        $otherToken = $user->createToken('stolen')->plainTextToken;

        $this->assertSame(2, $user->tokens()->count());

        $this->asToken($currentToken)
            ->putJson('/api/profile/password', [
                'current_password' => 'password123',
                'password' => 'BrandNewPass1',
                'password_confirmation' => 'BrandNewPass1',
            ])
            ->assertStatus(200)
            ->assertJsonPath('revoked_sessions', 1);

        $this->assertSame(1, $user->tokens()->count(), 'only the calling token should survive');

        // The revoked session must stop working immediately.
        $this->asToken($otherToken)
            ->getJson('/api/profile')
            ->assertStatus(401);

        // The calling session keeps working.
        $this->asToken($currentToken)
            ->getJson('/api/profile')
            ->assertStatus(200);

        $user->delete();
    }

    public function test_activity_returns_only_the_callers_own_real_events(): void
    {
        $user = $this->makeUser();
        $other = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile', ['full_name' => 'Logged Change', 'email' => $user->email])
            ->assertStatus(200);

        $this->asToken($other->createToken('t')->plainTextToken)
            ->putJson('/api/profile', ['full_name' => 'Other Change', 'email' => $other->email])
            ->assertStatus(200);

        $body = $this->asToken($user->createToken('t2')->plainTextToken)
            ->getJson('/api/profile/activity')
            ->assertStatus(200)
            ->json('data');

        $this->assertNotEmpty($body);
        foreach ($body as $row) {
            $this->assertStringNotContainsString(
                'Other Change',
                (string) ($row['details'] ?? ''),
                'activity must never include another operator\'s entries',
            );
        }

        $user->delete();
        $other->delete();
    }

    public function test_preferences_require_a_real_timezone(): void
    {
        $user = $this->makeUser();

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/profile/preferences', [
                'is_dark_mode' => true,
                'email_alerts' => false,
                'timezone' => 'Not/ARealZone',
                'locale' => 'en',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('timezone');

        $user->delete();
    }

    public function test_profile_endpoints_require_authentication(): void
    {
        $this->asAnonymous()->getJson('/api/profile')->assertStatus(401);
        $this->asAnonymous()->putJson('/api/profile', [])->assertStatus(401);
        $this->asAnonymous()->putJson('/api/profile/preferences', [])->assertStatus(401);
        $this->asAnonymous()->putJson('/api/profile/password', [])->assertStatus(401);
        $this->asAnonymous()->postJson('/api/profile/avatar', [])->assertStatus(401);
        $this->asAnonymous()->getJson('/api/profile/activity')->assertStatus(401);
        $this->asAnonymous()->getJson('/api/profile/facilities')->assertStatus(401);
    }
}
