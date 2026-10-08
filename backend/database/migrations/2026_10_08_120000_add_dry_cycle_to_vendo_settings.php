<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Vendo Configuration screen presents a "Dry Cycle" with a duration and a
 * price and tells the operator what the customer has to insert. Neither field
 * existed here: the page copied them from the standard cycle on load and
 * handleSave() wrote back only standard_* and premium_*, so anything typed
 * into Dry silently vanished on the next poll.
 *
 * These columns give that cycle somewhere to live.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('vendo_settings', 'dry_duration_min')) {
            return;
        }

        Schema::table('vendo_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('dry_duration_min')->default(8)->after('premium_duration_min');
            $table->decimal('dry_price', 10, 2)->default(40.00)->after('dry_duration_min');
        });
    }

    public function down(): void
    {
        Schema::table('vendo_settings', function (Blueprint $table) {
            $table->dropColumn(['dry_duration_min', 'dry_price']);
        });
    }
};