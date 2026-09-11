<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensor_logs', function (Blueprint $table) {
            $table->id();
            $table->string('device_id', 50);
            $table->float('water_level')->nullable();
            $table->float('soap_a_level')->nullable();
            $table->float('soap_b_level')->nullable();
            $table->float('wax_level')->nullable();
            $table->float('temperature')->nullable();
            $table->float('flow_rate')->nullable();
            $table->timestamp('recorded_at')->useCurrent();

            $table->foreign('device_id')->references('id')->on('devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sensor_logs');
    }
};
