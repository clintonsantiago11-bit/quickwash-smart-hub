<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        // Idempotent seeding: rows are created/updated in place so live
        // telemetry (sensor logs, transactions, alerts) survives restarts.

        DB::table('facilities')->updateOrInsert(
            ['id' => 1],
            ['name' => 'QuickWash Main Facility', 'status' => 'active']
        );

        $this->seedAdmin();

        $devices = [
            ['id' => 'esp32_bay_1', 'facility_id' => 1, 'name' => 'Main Wash Controller', 'type' => 'controller'],
            ['id' => 'esp32_cam_1', 'facility_id' => 1, 'name' => 'Bay Camera', 'type' => 'camera'],
            ['id' => 'esp32_vending', 'facility_id' => 1, 'name' => 'Coin Acceptor Node', 'type' => 'vending'],
        ];

        foreach ($devices as $device) {
            DB::table('devices')->updateOrInsert(
                ['id' => $device['id']],
                ['facility_id' => $device['facility_id'], 'name' => $device['name'], 'type' => $device['type']]
            );
        }

        Schema::enableForeignKeyConstraints();
    }

    /**
     * Create/maintain the first admin account without shipping a known password.
     *
     * - ADMIN_PASSWORD set  -> the admin is created, or its password reset to it.
     * - ADMIN_PASSWORD unset and the admin exists -> password left untouched, so
     *   a redeploy never silently resets a live credential.
     * - ADMIN_PASSWORD unset and no admin yet -> a random password is generated,
     *   hashed, and printed once so the operator can sign in and change it.
     */
    private function seedAdmin(): void
    {
        $email = (string) env('ADMIN_EMAIL', 'admin@quickwash.hub');
        $password = (string) env('ADMIN_PASSWORD', '');
        $exists = DB::table('users')->where('email', $email)->exists();

        $attributes = [
            'username' => (string) env('ADMIN_USERNAME', 'admin'),
            'full_name' => (string) env('ADMIN_FULL_NAME', 'System Administrator'),
            'role' => 'admin',
            'facility_id' => 1,
            'is_dark_mode' => true,
            'email_alerts' => false,
        ];

        if ($password !== '') {
            $attributes['password_hash'] = Hash::make($password);
        } elseif ($exists) {
            DB::table('users')->where('email', $email)->update($attributes);

            return;
        } else {
            $password = Str::password(16);
            $attributes['password_hash'] = Hash::make($password);

            if (isset($this->command)) {
                $this->command->warn("No ADMIN_PASSWORD set - generated one for {$email}: {$password}");
                $this->command->warn('Sign in and change it immediately (Profile -> password).');
            }
        }

        DB::table('users')->updateOrInsert(['email' => $email], $attributes);
    }
}