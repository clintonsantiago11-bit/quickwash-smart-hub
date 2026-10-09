<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemSettingController extends Controller
{
    /**
     * Read the current settings.
     *
     * Any signed-in user may read: the dashboard renders the values, and a
     * technician still needs to see what the thresholds are in order to
     * diagnose why an alert fired. Only writing is role-gated.
     */
    public function show(Request $request): JsonResponse
    {
        $settings = SystemSetting::config();

        return response()->json([
            'settings' => [
                'low_water_pct' => $settings->low_water_pct,
                'low_soap_pct' => $settings->low_soap_pct,
                'low_wax_pct' => $settings->low_wax_pct,
                'stale_device_seconds' => $settings->stale_device_seconds,
                'audit_retention_days' => $settings->audit_retention_days,
                'mqtt_broker_host' => $settings->brokerHost(),
                'mqtt_broker_port' => $settings->brokerPort(),
                'mqtt_topic_prefix' => $settings->topicPrefix(),
            ],

            // What the running MQTT clients are actually pointed at. Reported
            // separately so the UI can say plainly that saving a new host does
            // not move a live connection.
            'broker_in_effect' => $settings->brokerInEffect(),

            'updated_at' => $settings->updated_at?->toIso8601String(),

            // Whether this caller may save. The UI hides the button rather than
            // letting the operator click into a 403.
            'can_edit' => in_array($request->user()->role, ['admin', 'manager'], true),
        ]);
    }

    /**
     * Store new settings.
     *
     * Bounds are enforced here rather than trusting the column types:
     * unsignedTinyInteger would silently reject 300 on a strict-mode write, but
     * a 422 naming the field is more use than a driver error.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'low_water_pct' => ['required', 'integer', 'min:0', 'max:100'],
            'low_soap_pct' => ['required', 'integer', 'min:0', 'max:100'],
            'low_wax_pct' => ['required', 'integer', 'min:0', 'max:100'],

            // Floored at 30: the bridge already treats a device as stale after
            // 90s (iot-bridge/db.js), and the API uses 30s on /devices. Going
            // below those would make the dashboard disagree with the agent
            // about the same device and flicker it online and offline.
            'stale_device_seconds' => ['required', 'integer', 'min:30', 'max:3600'],

            'audit_retention_days' => ['required', 'integer', 'min:7', 'max:3650'],
            'mqtt_broker_host' => ['nullable', 'string', 'max:255', 'regex:/^[A-Za-z0-9.\-_]+$/'],
            'mqtt_broker_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'mqtt_topic_prefix' => ['nullable', 'string', 'max:100'],
        ]);

        $settings = SystemSetting::config();

        // Record only what actually changed. An audit line reading
        // "updated 8 settings" every time someone hits Save tells an auditor
        // nothing about what changed.
        $before = $settings->only(array_keys($validated));
        $settings->update($validated);
        $after = $settings->fresh()->only(array_keys($validated));

        $changed = [];
        foreach ($validated as $field => $value) {
            if ((string) $before[$field] !== (string) $after[$field]) {
                $changed[] = sprintf(
                    '%s from %s to %s',
                    $field,
                    $before[$field] === null ? 'unset' : $before[$field],
                    $after[$field] === null ? 'unset' : $after[$field],
                );
            }
        }

        if ($changed) {
            AuditLog::create([
                'user_id' => $request->user()->id,
                'user' => $request->user()->full_name,
                'ip_address' => $request->ip(),
                'action' => 'SYSTEM_SETTINGS',
                'details' => 'Changed system settings: ' . implode('; ', $changed),
            ]);
        }

        return response()->json([
            'success' => true,
            'changed' => $changed,
            'settings' => [
                'low_water_pct' => $settings->low_water_pct,
                'low_soap_pct' => $settings->low_soap_pct,
                'low_wax_pct' => $settings->low_wax_pct,
                'stale_device_seconds' => $settings->stale_device_seconds,
                'audit_retention_days' => $settings->audit_retention_days,
                'mqtt_broker_host' => $settings->brokerHost(),
                'mqtt_broker_port' => $settings->brokerPort(),
                'mqtt_topic_prefix' => $settings->topicPrefix(),
            ],
            'broker_in_effect' => $settings->brokerInEffect(),
        ]);
    }
}