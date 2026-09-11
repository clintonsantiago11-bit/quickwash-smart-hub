<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendoSetting extends Model
{
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'standard_duration_min',
        'standard_price',
        'premium_duration_min',
        'premium_price',
        'coin_timeout_seconds',
    ];

    protected $casts = [
        'standard_duration_min' => 'integer',
        'standard_price' => 'float',
        'premium_duration_min' => 'integer',
        'premium_price' => 'float',
        'coin_timeout_seconds' => 'integer',
    ];

    public static function config(): self
    {
        return static::query()->first() ?? static::query()->create([
            'standard_duration_min' => 10,
            'standard_price' => 50.00,
            'premium_duration_min' => 15,
            'premium_price' => 100.00,
            'coin_timeout_seconds' => 5,
        ]);
    }
}