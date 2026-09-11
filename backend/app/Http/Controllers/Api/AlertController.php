<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    public function index()
    {
        $alerts = Alert::with('device')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($alert) {
                return [
                    'id' => $alert->id,
                    'device' => $alert->device_id,
                    'type' => $alert->type,
                    'severity' => $alert->severity,
                    'message' => $alert->message,
                    'status' => $alert->resolved ? 'resolved' : 'active',
                    'time' => $alert->created_at?->diffForHumans() ?? 'unknown time',
                ];
            });

        return response()->json($alerts);
    }

    public function resolve(Request $request, Alert $alert)
    {
        $alert->update([
            'resolved' => true,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $typeLabels = [
            'JAM_ERROR' => 'Motor jam',
            'LOW_SOAP' => 'Low soap supply',
            'LOW_WATER' => 'Low water level',
            'SYSTEM_ALERT' => 'System',
        ];

        AuditLog::create([
            'user_id' => $request->user()->id,
            'user' => $request->user()->full_name,
            'ip_address' => $request->ip(),
            'action' => 'RESOLVE_ALERT',
            'details' => 'Marked the ' . ($typeLabels[$alert->type] ?? 'system') . " alert on the " . ($alert->device->name ?? $alert->device_id) . ' as resolved',
        ]);

        return response()->json(['success' => true]);
    }
}
