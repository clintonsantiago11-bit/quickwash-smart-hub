<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wash_logs', function (Blueprint $table) {
            $table->id();
            $table->string('device_id', 50);
            $table->string('cycle_type', 50)->default('standard');
            $table->decimal('price', 10, 2)->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->useCurrent();
            $table->unsignedInteger('duration_seconds')->default(0);

            $table->foreign('device_id')->references('id')->on('devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wash_logs');
    }
};