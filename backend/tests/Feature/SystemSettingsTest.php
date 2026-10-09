<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The settings screen used to write the broker host, broker port and the
 * low-water / low-soap thresholds to localStorage and read them back from
 * nowhere. config('mqtt.*') came from environment variables and no code
 * compared a tank level to a threshold at all, so changing a value and seeing
 * "Saved" meant only that a string had been stored in one browser.
 *
 * These assert the values now live on the server, are validated, are gated by
 * role, and are recorded in the audit trail when they actually change.
 */
class SystemSettingsTest extends TestCase
{
    private function makeUser(string $role): User
    {
        $user = new User();
        $user->forceFill([
            'username' => 'settings_' . $role . '_' . uniqid(),
            'full_name' => 'Settings ' . $role,
            'email' => 'settings_' . $role . '_' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123'),
            'role' => $role,
            'facility_id' => 1,
        ])->save();

        return $user;
    }

    /** A complete, valid payload. Merged into per-test variations. */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'low_water_pct' => 25,
            'low_soap_pct' => 18,
            'low_wax_pct' => 12,
            'stale_device_seconds' => 120,
            'audit_retention_days' => 180,
            'mqtt_broker_host' => 'broker.example.com',
            'mqtt_broker_port' => 8883,
            'mqtt_topic_prefix' => 'quickwash/test',
        ], $overrides);
    }

    public function test_thresholds_survive_a_round_trip(): void
    {
        $user = $this->makeUser('admin');

        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/settings', $this->payload([
                'low_water_pct' => 35,
                'low_soap_pct' => 22,
                'low_wax_pct' => 9,
            ]))
            ->assertStatus(200);

        $body = $this->asToken($user->createToken('t')->plainTextToken)
            ->getJson('/api/settings')
            ->assertStatus(200)
            ->json();

        // These are the values the old screen threw away. If they survive the
        // round trip, the page is finally storing something real.
        $this->assertSame(35, $body['settings']['low_water_pct']);
        $this->assertSame(22, $body['settings']['low_soap_pct']);
        $this->assertSame(9, $body['settings']['low_wax_pct']);
        $this->assertSame(8883, $body['settings']['mqtt_broker_port']);
        $this->assertSame('broker.example.com', $body['settings']['mqtt_broker_host']);

        $user->delete();
    }

    public function test_out_of_range_thresholds_are_rejected(): void
    {
        $user = $this->makeUser('admin');
        $token = $user->createToken('t')->plainTextToken;

        // A percentage above 100 would overflow the column rather than being
        // stored, so the controller has to reject it with a field-level 422.
        $this->asToken($token)
            ->putJson('/api/settings', $this->payload(['low_water_pct' => 150]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['low_water_pct']);

        $this->asToken($token)
            ->putJson('/api/settings', $this->payload(['low_soap_pct' => -5]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['low_soap_pct']);

        // Below the 30s floor the dashboard would contradict the bridge, which
        // marks devices stale at 90s.
        $this->asToken($token)
            ->putJson('/api/settings', $this->payload(['stale_device_seconds' => 5]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stale_device_seconds']);

        $this->asToken($token)
            ->putJson('/api/settings', $this->payload(['mqtt_broker_port' => 70000]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['mqtt_broker_port']);

        $user->delete();
    }

    public function test_a_malformed_broker_host_is_rejected(): void
    {
        $user = $this->makeUser('admin');

        // Hostname and IP only. Allowing an arbitrary string here would let a
        // stored value contain a scheme, credentials or a path, none of which
        // belong in a host field.
        $this->asToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/settings', $this->payload(['mqtt_broker_host' => 'mqtt://evil:8883/x']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['mqtt_broker_host']);

        $user->delete();
    }

    public function test_a_technician_cannot_change_settings(): void
    {
        $tech = $this->makeUser('technician');
        $token = $tech->createToken('t')->plainTextToken;

        $this->asToken($token)
            ->putJson('/api/settings', $this->payload())
            ->assertStatus(403);

        // Reading is allowed, and must say so, so the UI can hide the button
        // instead of letting the operator click into a 403.
        $this->asToken($token)
            ->getJson('/api/settings')
            ->assertStatus(200)
            ->assertJsonPath('can_edit', false);

        $tech->delete();
    }

    public function test_an_admin_is_told_they_can_edit(): void
    {
        $admin = $this->makeUser('admin');

        $this->asToken($admin->createToken('t')->plainTextToken)
            ->getJson('/api/settings')
            ->assertStatus(200)
            ->assertJsonPath('can_edit', true);

        $admin->delete();
    }

    public function test_settings_require_authentication(): void
    {
        $this->asAnonymous()->getJson('/api/settings')->assertStatus(401);
        $this->asAnonymous()->putJson('/api/settings', $this->payload())->assertStatus(401);
    }

    public function test_a_change_is_recorded_in_the_audit_trail(): void
    {
        $admin = $this->makeUser('admin');
        $before = AuditLog::where('action', 'SYSTEM_SETTINGS')->count();

        $response = $this->asToken($admin->createToken('t')->plainTextToken)
            ->putJson('/api/settings', $this->payload(['low_water_pct' => 44]))
            ->assertStatus(200);

        $this->assertSame(
            $before + 1,
            AuditLog::where('action', 'SYSTEM_SETTINGS')->count(),
            'a real change must leave a trace',
        );

        // The audit line names the fields that moved, not just "updated".
        $log = AuditLog::where('action', 'SYSTEM_SETTINGS')->latest('id')->first();
        $this->assertStringContainsString('low_water_pct', $log->details);
        $this->assertStringContainsString('44', $log->details);

        // `changed` is a list of human-readable "field from a to b" strings, so
        // assert on the field name appearing rather than on an exact value.
        $changed = $response->json('changed');
        $this->assertIsArray($changed);
        $this->assertNotEmpty($changed, 'a change was made, so something must be reported');
        $this->assertStringContainsString('low_water_pct', implode('; ', $changed));

        $this->assertStringNotContainsString('audit_retention_days', implode('; ', $changed));

        $admin->delete();
    }

    public function test_saving_identical_values_writes_no_audit_row(): void
    {
        $admin = $this->makeUser('admin');
        $token = $admin->createToken('t')->plainTextToken;

        // Put known values in place first, so the second save is a genuine
        // no-op rather than coincidentally equal.
        $this->asToken($token)->putJson('/api/settings', $this->payload([
            'low_water_pct' => 33,
        ]))->assertStatus(200);

        $before = AuditLog::where('action', 'SYSTEM_SETTINGS')->count();

        $response = $this->asToken($token)
            ->putJson('/api/settings', $this->payload(['low_water_pct' => 33]))
            ->assertStatus(200);

        $this->assertSame(
            $before,
            AuditLog::where('action', 'SYSTEM_SETTINGS')->count(),
            'a save that changes nothing should not clutter the audit trail',
        );
        $this->assertSame([], $response->json('changed'));

        $admin->delete();
    }

    public function test_the_page_reports_which_broker_is_live(): void
    {
        $admin = $this->makeUser('admin');

        // The running clients read environment variables, so a stored host is
        // not the live one. The response has to carry both, or the UI implies
        // a change took effect when it did not.
        $body = $this->asToken($admin->createToken('t')->plainTextToken)
            ->getJson('/api/settings')
            ->assertStatus(200)
            ->json();

        $this->assertArrayHasKey('broker_in_effect', $body);
        $this->assertArrayHasKey('host', $body['broker_in_effect']);
        $this->assertSame(
            config('mqtt.host'),
            $body['broker_in_effect']['host'],
            'broker_in_effect must report the environment value, not the stored one',
        );

        $admin->delete();
    }

    public function test_the_singleton_row_exists_with_defaults(): void
    {
        $settings = SystemSetting::config();

        foreach ([
            'low_water_pct', 'low_soap_pct', 'low_wax_pct',
            'stale_device_seconds', 'audit_retention_days', 'mqtt_broker_port',
        ] as $field) {
            $this->assertNotNull($settings->{$field}, "missing default for {$field}");
        }
    }
}