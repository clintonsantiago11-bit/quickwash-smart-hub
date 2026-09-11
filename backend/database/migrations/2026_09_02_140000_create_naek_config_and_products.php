<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NAEK device mirror tables:
 *   naek_config   = desired+observed device state (shop name, LCD sleep, live credits/sales)
 *   naek_products = 3 product slots mirrored from the device. Editable fields (name/rate/
 *                   duration_seconds/pause_enabled) are the DESIRED state the agent pushes
 *                   to the device via its stock /save endpoint when sync_pending=1; usage/
 *                   net/status are live read-only values the agent writes after each poll.
 * sync_pending=1 means a human edited the dashboard and the agent has not applied it yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('naek_config', function (Blueprint $table) {
            $table->string('device_id', 50)->primary();
            $table->string('shop_name', 100)->default('');
            $table->integer('lcd_sleep_min')->default(60);
            $table->integer('credits')->default(0);      // live, read-only
            $table->integer('total_sales')->default(0);  // live, read-only
            $table->boolean('sync_pending')->default(false); // dashboard edit not yet applied
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('naek_products', function (Blueprint $table) {
            $table->string('device_id', 50);
            $table->tinyInteger('slot'); // 0,1,2 -> product order on the device
            $table->string('name', 50)->default('');
            $table->integer('rate')->default(0);          // ₱ per cycle (editable)
            $table->integer('duration_seconds')->default(0); // (editable)
            $table->boolean('pause_enabled')->default(true); // (editable)
            $table->integer('usage')->default(0);         // live, read-only
            $table->integer('net')->default(0);           // live, read-only
            $table->enum('status', ['ON', 'OFF'])->default('OFF'); // live
            $table->boolean('sync_pending')->default(false); // dashboard edit not yet applied
            $table->timestamps();
            $table->primary(['device_id', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('naek_config');
        Schema::dropIfExists('naek_products');
    }
};
