<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NaekConfig;
use App\Models\NaekProduct;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NaekConfigController extends Controller
{
    /**
     * Return the NAEK device mirror (desired+observed state) so the dashboard
     * can render exactly what the device shows, plus sync_pending flags.
     */
    public function show(Request $request)
    {
        $deviceId = $request->query('device_id', 'naek_carwash_1');

        $config = NaekConfig::firstOrCreate(
            ['device_id' => $deviceId],
            ['shop_name' => '', 'lcd_sleep_min' => 60, 'sync_pending' => false]
        );
        $products = NaekProduct::where('device_id', $deviceId)->orderBy('slot')->get();

        return response()->json([
            'device_id' => $deviceId,
            'shop_name' => $config->shop_name,
            'lcd_sleep_min' => $config->lcd_sleep_min,
            'credits' => $config->credits,
            'total_sales' => $config->total_sales,
            'sync_pending' => (bool) $config->sync_pending,
            'last_seen_at' => $config->last_seen_at,
            'products' => $products->map(fn ($p) => [
                'slot' => $p->slot,
                'name' => $p->name,
                'rate' => $p->rate,
                'duration_seconds' => $p->duration_seconds,
                'pause_enabled' => (bool) $p->pause_enabled,
                'sync_pending' => (bool) $p->sync_pending,
                'usage' => $p->usage,
                'net' => $p->net,
                'status' => $p->status,
            ]),
        ]);
    }

    /**
     * Apply a dashboard edit: upsert the mirror and flag sync_pending=1 so the
     * iot-bridge NAEK agent pushes it to the device on its next poll. Only
     * editable fields are accepted; read-only live fields are ignored.
     */
    public function update(Request $request)
    {
        $deviceId = $request->input('device_id', 'naek_carwash_1');

        $validated = $request->validate([
            'shop_name' => 'sometimes|string|max:100',
            'lcd_sleep_min' => 'sometimes|integer|min:1|max:720',
            'products' => 'sometimes|array|max:3',
            'products.*.slot' => 'required_with:products|integer|between:0,2',
            'products.*.name' => 'required_with:products|string|max:50',
            'products.*.rate' => 'required_with:products|integer|min:0|max:9999',
            'products.*.duration_seconds' => 'required_with:products|integer|min:1|max:3600',
            'products.*.pause_enabled' => 'sometimes|boolean',
        ]);

        DB::transaction(function () use ($validated, $deviceId) {
            $config = NaekConfig::firstOrCreate(['device_id' => $deviceId]);

            if (array_key_exists('shop_name', $validated)) {
                $config->shop_name = $validated['shop_name'];
                $config->sync_pending = true;
            }
            if (array_key_exists('lcd_sleep_min', $validated)) {
                $config->lcd_sleep_min = $validated['lcd_sleep_min'];
                $config->sync_pending = true;
            }
            $config->save();

            foreach ($validated['products'] ?? [] as $prod) {
                $slot = $prod['slot'];
                $p = NaekProduct::firstOrNew(['device_id' => $deviceId, 'slot' => $slot]);
                $p->name = $prod['name'];
                $p->rate = $prod['rate'];
                $p->duration_seconds = $prod['duration_seconds'];
                if (array_key_exists('pause_enabled', $prod)) {
                    $p->pause_enabled = $prod['pause_enabled'];
                }
                $p->sync_pending = true;
                $p->save();
            }
        });

        return $this->show($request);
    }
}