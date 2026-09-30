<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the queries the dashboard actually runs.
 *
 * Every hot query was a full table scan. EXPLAIN showed type=ALL with
 * possible_keys=NULL on vending_transactions and wash_logs, and
 * type=ALL plus "Using filesort" on the alerts list that the header fetches
 * on every page. sensor_logs could use the device_id foreign key but still
 * sorted the result because recorded_at had no index, and it is the table
 * that grows fastest.
 *
 * These are additive and do not rewrite existing rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vending_transactions', function (Blueprint $table) {
            $table->index('transaction_time', 'vt_transaction_time_idx');
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            $table->index('completed_at', 'wl_completed_at_idx');
        });

        Schema::table('sensor_logs', function (Blueprint $table) {
            $table->index('recorded_at', 'sl_recorded_at_idx');
            // The dashboard asks for the most recent row for one device, so a
            // composite index answers it without sorting.
            $table->index(['device_id', 'recorded_at'], 'sl_device_recorded_idx');
        });

        Schema::table('alerts', function (Blueprint $table) {
            $table->index('created_at', 'al_created_at_idx');
            $table->index('resolved', 'al_resolved_idx');
            $table->index(['resolved', 'created_at'], 'al_resolved_created_idx');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('created_at', 'au_created_at_idx');
            $table->index('user_id', 'au_user_id_idx');
            $table->index(['action', 'created_at'], 'au_action_created_idx');
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->index('last_seen', 'dev_last_seen_idx');
            $table->index('type', 'dev_type_idx');
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropIndex('dev_last_seen_idx');
            $table->dropIndex('dev_type_idx');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('au_created_at_idx');
            $table->dropIndex('au_user_id_idx');
            $table->dropIndex('au_action_created_idx');
        });

        Schema::table('alerts', function (Blueprint $table) {
            $table->dropIndex('al_created_at_idx');
            $table->dropIndex('al_resolved_idx');
            $table->dropIndex('al_resolved_created_idx');
        });

        Schema::table('sensor_logs', function (Blueprint $table) {
            $table->dropIndex('sl_recorded_at_idx');
            $table->dropIndex('sl_device_recorded_idx');
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            $table->dropIndex('wl_completed_at_idx');
        });

        Schema::table('vending_transactions', function (Blueprint $table) {
            $table->dropIndex('vt_transaction_time_idx');
        });
    }
};
