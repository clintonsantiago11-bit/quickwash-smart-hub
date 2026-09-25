<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'username',
        'full_name',
        'email',
        'password_hash',
        'role',
        'facility_id',
        'avatar_url',
        'phone',
        'designation',
        'is_dark_mode',
        'email_alerts',
    ];

    protected $hidden = [
        'password_hash',
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
