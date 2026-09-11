<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->string('id', 50)->primary()->comment('ESP32 MAC Address or custom ID');
            $table->foreignId('facility_id')->default(1)->constrained('facilities')->cascadeOnDelete();
            $table->string('name', 100);
            $table->enum('type', ['controller', 'camera', 'vending']);
            $table->string('ip_address', 45)->nullable();
            $table->enum('status', ['online', 'offline', 'error'])->default('offline');
            $table->timestamp('last_seen')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
