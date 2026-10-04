<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\VendingTransaction;
use App\Models\WashLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Cloud ingest endpoint for the NAEK edge agent (NAEK_SINK=api mode).
 *
 * The agent runs on the carwash PC (outbound HTTPS only) and pushes
 * NAEK page snapshots + sale events here. Auth is a shared API key
 * header (x-api-key) compared against NAEK_INGEST_KEY, which must be set
 * on BOTH sides. The endpoint refuses to serve traffic if the key is
 * missing on the API host rather than falling back to a default.
 */
class NaekIngestController extends Controller
{
    public function store(Request $request)
    {
        $expected = (string) config('services.naek.ingest_key', '');

        // Fail closed. An unset or blank key must never silently open this
        // endpoint: it is unauthenticated by design, and anyone who can reach
        // it can write sale telemetry straight into the revenue tables. There
        // is deliberately no default value to fall back on.
        if ($expected === '') {
            Log::error('NAEK ingest rejected: NAEK_INGEST_KEY is not configured on the API host.');

            return response()->json([
                'error' => ['code' => 'MISCONFIGURED', 'message' => 'Ingest is not configured on this server.'],
            ], 500);
        }

        // Constant-time compare so the key cannot be recovered by timing the
        // response. hash_equals() is the only safe choice for a shared secret.
        if (!hash_equals($expected, (string) $request->header('x-api-key', ''))) {
            Log::warning('NAEK ingest rejected: invalid API key from ' . $request->ip());

            return response()->json(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Invalid API key']], 401);
        }

        $validated = $request->validate([
            'deviceId' => 'required|string|max:50',
            'deviceName' => 'nullable|string|max:100',
            'snapshot' => 'required|array',
            'snapshot.shopName' => 'nullable|string|max:100',
            'snapshot.credits' => 'nullable|integer|min:0',
            'snapshot.totalSales' => 'nullable|integer|min:0',
            'snapshot.products' => 'required|array|min:1',
            'snapshot.products.*.name' => 'required|string|max:50',
            'snapshot.products.*.rate' => 'required|integer|min:0',
            'snapshot.products.*.duration' => 'required|integer|min:0',
            'snapshot.products.*.status' => 'required|in:ON,OFF',
            'snapshot.products.*.usage' => 'required|integer|min:0',
            'events' => 'present|array',
            'events.*.type' => 'required_with:events|in:sale,sales_reset,total_reset',
            'events.*.product' => 'required_if:events.*.type,sale|string|max:50',
            'events.*.count' => 'nullable|integer|min:1',
            'events.*.amount' => 'required_if:events.*.type,sale|numeric|min:0',
            'events.*.durationSeconds' => 'nullable|integer|min:0',
        ]);

        $deviceId = $validated['deviceId'];
        $deviceName = $validated['deviceName'] ?? $deviceId;

        // Register/refresh the device heartbeat (agent is clearly reachable)
        Device::updateOrCreate(
            ['id' => $deviceId],
            [
                'facility_id' => 1,
                'name' => $deviceName,
                'type' => 'vending',
                'status' => 'online',
                'last_seen' => now(),
            ]
        );

        $ingested = 0;
        foreach ($validated['events'] as $event) {
            if (($event['type'] ?? '') === 'sale') {
                $now = now();
                $duration = (int) ($event['durationSeconds'] ?? 0) * max(1, (int) ($event['count'] ?? 1));

                VendingTransaction::create([
                    'device_id' => $deviceId,
                    'amount' => $event['amount'],
                    'payment_method' => 'coin',
                    'transaction_time' => $now,
                ]);
                WashLog::create([
                    'device_id' => $deviceId,
                    'cycle_type' => strtolower($event['product']),
                    'price' => $event['amount'],
                    'started_at' => $now->copy()->subSeconds($duration),
                    'completed_at' => $now,
                    'duration_seconds' => $duration,
                ]);

// No audit row here on purpose. This sale is already recorded
                // as a VendingTransaction and a WashLog, which is where the
                // Vending and Analytics pages read it from. Writing it a third
                // time into the audit trail tripled the row count for every
                // coin without adding any information, and the audit trail is
                // meant to hold only events with no other home.
                $ingested++;
            } elseif (in_array($event['type'] ?? '', ['sales_reset', 'total_reset'], true)) {
                AuditLog::create([
                    'user' => 'System',
                    'action' => 'NAEK_SALES_RESET',
                    'details' => "Sales counters were reset on the {$deviceName} (device RESET SALES)",
                ]);
                $ingested++;
            }
        }

        return response()->json(['success' => true, 'ingested' => $ingested]);
    }
}
