<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WashLog extends Model
{
    protected $fillable = [
        'device_id', 'cycle_type', 'price', 'started_at', 'completed_at', 'duration_seconds',
    ];

    protected $casts = [
        'price' => 'float',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function device()
    {
        return $this->belongsTo(Device::class, 'device_id');
    }
}