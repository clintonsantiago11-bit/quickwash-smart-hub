<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NaekProduct extends Model
{
    // Composite PK (device_id, slot): tell Eloquent not to assume an auto id.
    public $incrementing = false;
    protected $keyType = 'string';
    protected $primaryKey = 'device_id';
    protected $table = 'naek_products';

    protected $fillable = [
        'device_id', 'slot', 'name', 'rate', 'duration_seconds',
        'pause_enabled', 'usage', 'net', 'status', 'sync_pending',
    ];

    protected $casts = [
        'rate' => 'integer',
        'duration_seconds' => 'integer',
        'pause_enabled' => 'boolean',
        'usage' => 'integer',
        'net' => 'integer',
        'sync_pending' => 'boolean',
    ];
}