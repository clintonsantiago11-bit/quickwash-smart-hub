<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    /**
     * Only the columns a user is allowed to change about themselves. Role,
     * facility_id, username and password_hash are deliberately absent: they
     * are privilege and identity columns, set only by the seeder or an
     * explicit assignment, never by request input.
     */
    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'designation',
        'avatar_url',
        'timezone',
        'locale',
        'is_dark_mode',
        'email_alerts',
    ];

    protected $hidden = [
        'password_hash',
    ];

    /**
     * Without these, last_login_at arrives as a raw string and the booleans
     * as 0/1, which the profile DTO then tries to format as a date.
     */
    protected $casts = [
        'last_login_at' => 'datetime',
        'is_dark_mode' => 'boolean',
        'email_alerts' => 'boolean',
        'facility_id' => 'integer',
    ];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function resolvedAlerts()
    {
        return $this->hasMany(Alert::class, 'resolved_by');
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }
}
