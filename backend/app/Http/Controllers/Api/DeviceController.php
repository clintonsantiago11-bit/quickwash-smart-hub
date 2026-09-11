<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\AuditLog;
use App\Services\MqttService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DeviceController extends Controller
{
    public function index()
    {
        $onlineCutoff = now()->subSeconds(30);

        $devices = Device::all()->map(function ($device) use ($onlineCutoff) {
            $lastSeen = $device->last_seen;
            $online = $lastSeen !== null && $lastSeen->gte($onlineCutoff);

            return [
                'id' => $device->id,
                'name' => $device->name,
                'type' => $device->type,
                'ip' => $device->ip_address,
                'status' => $online ? 'online' : 'offline',
                'uptime' => $lastSeen ? $lastSeen->diffForHumans() : '0m',
                'lastPing' => $lastSeen ? $lastSeen->diffForHumans() : 'never',
            ];
        });

        return response()->json($devices);
    }

    public function show($device)
    {
        $device = Device::findOrFail($device);
        return response()->json($device);
    }

    public function sendCommand(Request $request, $device)
    {
        $request->validate(['action' => 'required|string|in:trigger_wash,reset_jam,emergency_stop']);

        $device = Device::findOrFail($device);
        $topic = config('mqtt.topic_prefix') . '/command/' . $device->id;

        $payload = json_encode([
            'action' => $request->action,
            'timestamp' => now()->timestamp,
        ]);

        // Publish the command to the MQTT broker so the hardware receives it
        $published = false;
        try {
            $mqtt = app(MqttService::class);
            if ($mqtt->connect()) {
                $mqtt->publish($topic, $payload);
                $mqtt->disconnect();
                $published = true;
            }
        } catch (\Throwable $e) {
            Log::error("Failed to publish MQTT command: {$e->getMessage()}");
        }

        $commandLabels = [
            'trigger_wash' => 'Started a wash cycle',
            'reset_jam' => 'Cleared the jam alarm',
            'emergency_stop' => 'Pressed the emergency stop',
        ];

        AuditLog::create([
            'user_id' => $request->user()->id,
            'user' => $request->user()->full_name,
            'ip_address' => $request->ip(),
            'action' => 'DEVICE_COMMAND',
            'details' => ($commandLabels[$request->action] ?? "Sent command '{$request->action}'") . " on the {$device->name}",
        ]);

        return response()->json([
            'success' => $published,
            'topic' => $topic,
            'payload' => $payload,
        ], $published ? 200 : 502);
    }
}
