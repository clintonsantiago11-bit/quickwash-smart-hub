<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccessControlTest extends TestCase
{
    private function makeUser(string $role): User
    {
        $user = new User();

        // forceFill, not create(): role, username and password_hash are not
        // mass-assignable, which is the point — a test fixture setting them
        // has to say so explicitly, the same way a real admin flow would.
        $user->forceFill([
            'username' => 'tester_' . $role . '_' . uniqid(),
            'full_name' => 'Test ' . $role,
            'email' => 'tester_' . $role . '_' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123'),
            'role' => $role,
            'facility_id' => 1,
        ])->save();

        return $user;
    }

    public function test_technician_cannot_update_vending_settings(): void
    {
        $tech = $this->makeUser('technician');
        $token = $tech->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/vending/settings', [
                'standard_price' => 100.00,
                'premium_price' => 150.00,
                'standard_duration_min' => 5,
                'premium_duration_min' => 8,
                'dry_price' => 70.00,
                'dry_duration_min' => 4,
                'coin_timeout_seconds' => 30,
            ])
            ->assertStatus(403);

        $tech->delete();
    }

    public function test_technician_cannot_send_device_commands(): void
    {
        $tech = $this->makeUser('technician');
        $token = $tech->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/devices/esp32_bay_1/command', ['action' => 'trigger_wash'])
            ->assertStatus(403);

        $tech->delete();
    }

    public function test_admin_can_update_vending_settings(): void
    {
        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'admin123',
        ]);
        $token = $login->json('token');

        $this->withToken($token)
            ->putJson('/api/vending/settings', [
                'standard_price' => 100.00,
                'premium_price' => 150.00,
                'standard_duration_min' => 5,
                'premium_duration_min' => 8,
                'dry_price' => 70.00,
                'dry_duration_min' => 4,
                'coin_timeout_seconds' => 30,
            ])
            ->assertStatus(200);
    }
}
