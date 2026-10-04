<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    /**
     * Audit rows are append-only, so updated_at was never anything but a
     * duplicate of created_at on every insert, and nothing ever read it. Only
     * the creation time is managed now.
     *
     * The column is deliberately left in place. Dropping it would break the
     * IoT bridge, which writes this table with a raw INSERT naming updated_at
     * explicitly, and that bridge is deployed separately from this API. Once it
     * has been redeployed without the column, a migration can remove it.
     */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'user', 'ip_address', 'action', 'details'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}