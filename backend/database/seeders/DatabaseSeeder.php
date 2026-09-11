<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

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

        DB::table('users')->updateOrInsert(
            ['email' => 'admin@quickwash.hub'],
            [
                'username' => 'admin',
                'full_name' => 'System Administrator',
                'password_hash' => Hash::make('admin123'),
                'role' => 'admin',
                'facility_id' => 1,
                'is_dark_mode' => true,
                'email_alerts' => false,
            ]
        );

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
}