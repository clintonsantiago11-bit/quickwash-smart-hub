<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * System-wide settings that the dashboard can actually change.
 *
 * The settings screen existed long before this table and wrote everything to
 * localStorage. Nothing read it back: the broker host and port are consumed by
 * config('mqtt.*') from environment variables, and the low-water / low-soap
 * figures were read by nothing at all. An operator could change a threshold,
 * see "Saved", and have the machine carry on ignoring it.
 *
 * This gives those values somewhere durable and server-validated. One row,
 * id=1, because there is only ever one set of them.
 *
 * The broker columns are deliberately NOT what the live connection uses. The
 * MQTT client in the bridge is a separate process holding its own socket, and
 * the one in the API reads config() at construction. Writing a new value here
 * changes what a *future* client would connect to; it does not migrate a
 * running one. The UI says so rather than implying otherwise.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('system_settings')) {
            return;
        }

        Schema::create('system_settings', function (Blueprint $table) {
            $table->tinyIncrements('id');

            // Supply thresholds, as a percentage of tank capacity. unsignedTinyInteger
            // caps at 255 so 0-100 cannot be exceeded even if validation is bypassed;
            // the controller still rejects out-of-range values with a 422.
            $table->unsignedTinyInteger('low_water_pct')->default(20);
            $table->unsignedTinyInteger('low_soap_pct')->default(15);
            $table->unsignedTinyInteger('low_wax_pct')->default(15);

            // How long a device may go unheard before the dashboard calls it
            // offline. The bridge marks devices stale after 90s
            // (iot-bridge/db.js), so the floor here is below that or the two
            // disagree and a device flickers between online and offline.
            $table->unsignedSmallInteger('stale_device_seconds')->default(90);

            // How long audit rows are kept. The prune runs daily at 02:40
            // (routes/console.php) and defaults to 90 days in
            // App\Support\AuditRetention. Changing this only affects the next run.
            $table->unsignedSmallInteger('audit_retention_days')->default(90);

            // Broker coordinates, mirrored for display. See the class comment.
            $table->string('mqtt_broker_host', 255)->nullable();
            $table->unsignedSmallInteger('mqtt_broker_port')->default(1883);
            $table->string('mqtt_topic_prefix', 100)->nullable();

            $table->timestamps();
        });

        DB::table('system_settings')->insert([
            'id' => 1,
            'low_water_pct' => 20,
            'low_soap_pct' => 15,
            'low_wax_pct' => 15,
            'stale_device_seconds' => 90,
            'audit_retention_days' => 90,
            'mqtt_broker_port' => 1883,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};