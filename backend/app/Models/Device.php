<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Device extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'facility_id', 'name', 'type', 'ip_address', 'status', 'last_seen'
    ];

    protected $casts = [
        'last_seen' => 'datetime',
    ];

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function sensorLogs()
    {
        return $this->hasMany(SensorLog::class, 'device_id');
    }

    public function vendingTransactions()
    {
        return $this->hasMany(VendingTransaction::class, 'device_id');
    }

    public function alerts()
    {
        return $this->hasMany(Alert::class, 'device_id');
    }
}
