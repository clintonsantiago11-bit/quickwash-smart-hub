<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendingTransaction extends Model
{
    protected $table = 'vending_transactions';

    protected $fillable = [
        'device_id', 'amount', 'payment_method', 'transaction_time'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_time' => 'datetime',
    ];

    public function device()
    {
        return $this->belongsTo(Device::class, 'device_id');
    }
}
