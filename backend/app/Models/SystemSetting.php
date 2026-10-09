<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * System-wide settings, stored as a single row.
 *
 * Same singleton shape as VendoSetting::config() - a table with one row at
 * id=1, created with defaults on first use. That keeps every caller reading the
 * same row instead of a cache that can drift out of step with the database.
 */
class SystemSetting extends Model
{
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'low_water_pct',
        'low_soap_pct',
        'low_wax_pct',
        'stale_device_seconds',
        'audit_retention_days',
        'mqtt_broker_host',
        'mqtt_broker_port',
        'mqtt_topic_prefix',
    ];

    protected $casts = [
        'low_water_pct' => 'integer',
        'low_soap_pct' => 'integer',
        'low_wax_pct' => 'integer',
        'stale_device_seconds' => 'integer',
        'audit_retention_days' => 'integer',
        'mqtt_broker_port' => 'integer',
    ];

    /** The broker host in the shape MqttService builds its socket address from. */
    public function brokerHost(): string
    {
        // Null means "use whatever the environment provides", which is the
        // default. Showing an empty box rather than a fabricated host is the
        // honest rendering of that.
        return $this->mqtt_broker_host ?: (string) config('mqtt.host');
    }

    public function brokerPort(): int
    {
        return $this->mqtt_broker_port ?: (int) config('mqtt.port');
    }

    public function topicPrefix(): string
    {
        return $this->mqtt_topic_prefix ?: (string) config('mqtt.topic_prefix');
    }

    /**
     * The live values the running clients actually use, which are NOT
     * necessarily the ones stored here.
     *
     * The bridge reads MQTT_BROKER from its own .env and holds an open socket;
     * the API's MqttService reads config('mqtt.*') when it is constructed. A
     * row written through the settings screen does not move either of them. The
     * UI shows this so the operator can see which is in effect instead of
     * assuming the saved value took effect.
     */
    public function brokerInEffect(): array
    {
        return [
            'host' => (string) config('mqtt.host'),
            'port' => (int) config('mqtt.port'),
            'topic_prefix' => (string) config('mqtt.topic_prefix'),
        ];
    }

    public static function config(): self
    {
        return static::query()->first() ?? static::query()->create([
            'low_water_pct' => 20,
            'low_soap_pct' => 15,
            'low_wax_pct' => 15,
            'stale_device_seconds' => 90,
            'audit_retention_days' => 90,
            'mqtt_broker_port' => 1883,
        ]);
    }
}