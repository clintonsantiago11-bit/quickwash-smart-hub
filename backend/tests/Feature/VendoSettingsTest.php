<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\VendoSetting;
use App\Models\User;
use Tests\TestCase;

/**
 * The Vendo Configuration screen showed a "Dry Cycle" with a price and told
 * the operator what the customer has to insert, but neither field was ever
 * written back. The page copied them from the standard cycle on load, so
 * anything typed there was silently replaced by the next poll.
 */
class VendoSettingsTest extends TestCase
{
    private function admin(): User
    {
        $user = new User();
        $user->forceFill([
            'username' => 'vendo_' . uniqid(),
            'full_name' => 'Vendo Tester',
            'email' => 'vendo_' . uniqid() . '@example.com',
            'password_hash' => \Illuminate\Support\Facades\Hash::make('password123'),
            'role' => 'admin',
            'facility_id' => 1,
        ])->save();

        return $user;
    }

    private function token(User $user): string
    {
        return $user->createToken('t')->plainTextToken;
    }

    public function test_the_dry_cycle_is_stored_and_read_back(): void
    {
        $user = $this->admin();

        $this->asToken($this->token($user))->putJson('/api/vending/settings', [
            'standard_duration_min' => 10,
            'standard_price' => 50,
            'premium_duration_min' => 15,
            'premium_price' => 100,
            'dry_duration_min' => 6,
            'dry_price' => 35,
            'coin_timeout_seconds' => 5,
        ])->assertStatus(200);

        $body = $this->asToken($this->token($user))
            ->getJson('/api/vending/settings')
            ->assertStatus(200)
            ->json();

        $this->assertSame(6, $body['dry_duration_min'], 'the dry duration must survive a round trip');
        $this->assertSame(35.0, (float) $body['dry_price'], 'the dry price must survive a round trip');

        $user->delete();
    }

    public function test_the_dry_cycle_is_required_and_validated(): void
    {
        $user = $this->admin();

        // Without it the request is rejected, rather than silently defaulting
        // the dry cycle to whatever the standard cycle happens to be.
        $this->asToken($this->token($user))->putJson('/api/vending/settings', [
            'standard_duration_min' => 10,
            'standard_price' => 50,
            'premium_duration_min' => 15,
            'premium_price' => 100,
            'coin_timeout_seconds' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['dry_duration_min', 'dry_price']);

        $this->asToken($this->token($user))->putJson('/api/vending/settings', [
            'standard_duration_min' => 10,
            'standard_price' => 50,
            'premium_duration_min' => 15,
            'premium_price' => 100,
            'dry_duration_min' => 0,
            'dry_price' => 35,
            'coin_timeout_seconds' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['dry_duration_min']);

        $user->delete();
    }

    public function test_saving_is_recorded_in_the_audit_trail(): void
    {
        $user = $this->admin();
        $before = AuditLog::where('action', 'VENDO_CONFIG')->count();

        $this->asToken($this->token($user))->putJson('/api/vending/settings', [
            'standard_duration_min' => 10,
            'standard_price' => 50,
            'premium_duration_min' => 15,
            'premium_price' => 100,
            'dry_duration_min' => 6,
            'dry_price' => 35,
            'coin_timeout_seconds' => 5,
        ])->assertStatus(200);

        $this->assertSame($before + 1, AuditLog::where('action', 'VENDO_CONFIG')->count());

        $user->delete();
    }

    public function test_settings_default_to_a_complete_set_of_cycles(): void
    {
        // config() creates the row on first use, so every cycle the UI shows
        // must have a default behind it.
        $settings = VendoSetting::config();

        foreach ([
            'standard_duration_min',
            'premium_duration_min',
            'dry_duration_min',
            'standard_price',
            'premium_price',
            'dry_price',
            'coin_timeout_seconds',
        ] as $field) {
            $this->assertNotNull($settings->{$field}, "missing default for {$field}");
        }
    }
}