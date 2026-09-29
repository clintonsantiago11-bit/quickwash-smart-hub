<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real profile data instead of placeholders.
 *
 * last_login_at lets the profile show when the operator was last seen, which
 * was previously faked in the UI. timezone/locale make the preferences a user
 * can actually set per-person rather than a fixed facility-wide assumption.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('email_alerts');
            $table->string('timezone', 64)->default('Asia/Manila')->after('last_login_at');
            $table->string('locale', 8)->default('en')->after('timezone');

            // Email is looked up on every sign-in and cross-checked on every
            // profile save, so it deserves an index beyond its UNIQUE.
            $table->index('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['last_login_at']);
            $table->dropColumn(['last_login_at', 'timezone', 'locale']);
        });
    }
};
