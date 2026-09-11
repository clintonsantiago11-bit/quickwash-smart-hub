<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vending_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('device_id', 50);
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['coin'])->default('coin');
            $table->timestamp('transaction_time')->useCurrent();

            $table->foreign('device_id')->references('id')->on('devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vending_transactions');
    }
};
