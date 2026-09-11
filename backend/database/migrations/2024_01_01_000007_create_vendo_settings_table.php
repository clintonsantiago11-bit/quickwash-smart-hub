<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendo_settings', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->integer('standard_duration_min')->default(10);
            $table->decimal('standard_price', 10, 2)->default(50.00);
            $table->integer('premium_duration_min')->default(15);
            $table->decimal('premium_price', 10, 2)->default(100.00);
            $table->integer('coin_timeout_seconds')->default(5);
            $table->timestamps();
        });

        DB::table('vendo_settings')->insert([
            'id' => 1,
            'standard_duration_min' => 10,
            'standard_price' => 50.00,
            'premium_duration_min' => 15,
            'premium_price' => 100.00,
            'coin_timeout_seconds' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('vendo_settings');
    }
};