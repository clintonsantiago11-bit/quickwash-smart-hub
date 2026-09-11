<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NaekConfig extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $primaryKey = 'device_id';
    protected $table = 'naek_config';

    protected $fillable = [
        'device_id', 'shop_name', 'lcd_sleep_min',
        'credits', 'total_sales', 'sync_pending', 'last_seen_at',
    ];

    protected $casts = [
        'lcd_sleep_min' => 'integer',
        'credits' => 'integer',
        'total_sales' => 'integer',
        'sync_pending' => 'boolean',
        'last_seen_at' => 'datetime',
    ];
}