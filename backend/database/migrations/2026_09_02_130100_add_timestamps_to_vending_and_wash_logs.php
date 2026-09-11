<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Align vending_transactions and wash_logs with database_schema.sql:
 * both tables gain created_at / updated_at so Eloquent timestamps work.
 * Defaults keep the iot-bridge raw-SQL inserts (which omit them) valid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vending_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('vending_transactions', 'created_at')) {
                $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            }
            if (!Schema::hasColumn('vending_transactions', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            }
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('wash_logs', 'created_at')) {
                $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            }
            if (!Schema::hasColumn('wash_logs', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            }
        });
    }

    public function down(): void
    {
        Schema::table('vending_transactions', function (Blueprint $table) {
            $table->dropColumn(['created_at', 'updated_at']);
        });
        Schema::table('wash_logs', function (Blueprint $table) {
            $table->dropColumn(['created_at', 'updated_at']);
        });
    }
};
