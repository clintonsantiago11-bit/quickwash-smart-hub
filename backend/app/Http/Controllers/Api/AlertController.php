<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AlertController extends Controller
{
    /** How many alerts the header is ever shown. */
    private const MAX_ALERTS = 100;

    /** Seconds an alert list is shared between callers. */
    private const CACHE_SECONDS = 5;

    /**
     * The header fetches this on every page, so with a dozen browsers open it
     * is the most-requested endpoint in the app. Cached for a few seconds,
     * which is far below the resolution anyone can perceive on a fault
     * list, and capped so a long-running site cannot return every alert it
     * has ever recorded.
     */
    public function index()
    {
        $alerts = Cache::remember('alerts.index', self::CACHE_SECONDS, function () {
            return Alert::with('device')
                ->orderByDesc('created_at')
                ->limit(self::MAX_ALERTS)
                ->get()
                ->map(fn ($alert) => [
                    'id' => $alert->id,
                    'device' => $alert->device_id,
                    'type' => $alert->type,
                    'severity' => $alert->severity,
                    'message' => $alert->message,
                    'status' => $alert->resolved ? 'resolved' : 'active',
                    'time' => $alert->created_at?->diffForHumans() ?? 'unknown time',
                ]);
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

        // The list is cached, so a resolved alert would otherwise linger in
        // every open header for the rest of the TTL. An operator acting on a
        // fault needs to see it clear immediately.
        Cache::forget('alerts.index');

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
