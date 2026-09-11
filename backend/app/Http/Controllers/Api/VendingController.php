<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VendingTransaction;
use App\Models\VendoSetting;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class VendingController extends Controller
{
    public function index(Request $request)
    {
        $transactions = VendingTransaction::with('device')
            ->orderBy('transaction_time', 'desc')
            ->paginate(50);

        $transactions->getCollection()->transform(function ($txn) {
            return [
                'id' => 'TXN-' . str_pad($txn->id, 6, '0', STR_PAD_LEFT),
                'amount' => (float) $txn->amount,
                'method' => $txn->payment_method,
                'time' => $txn->transaction_time?->format('Y-m-d H:i:s') ?? '-',
                'status' => 'completed',
            ];
        });

        return response()->json($transactions);
    }

    public function stats()
    {
        $today = VendingTransaction::whereDate('transaction_time', today());
        $totalToday = (float) $today->sum('amount');
        $countToday = $today->count();

        $allTime = (float) VendingTransaction::sum('amount');

        return response()->json([
            'today_collected' => $totalToday,
            'today_transactions' => $countToday,
            'all_time_collected' => $allTime,
        ]);
    }

    public function settings()
    {
        $settings = VendoSetting::config();

        return response()->json([
            'standard_duration_min' => $settings->standard_duration_min,
            'standard_price' => $settings->standard_price,
            'premium_duration_min' => $settings->premium_duration_min,
            'premium_price' => $settings->premium_price,
            'coin_timeout_seconds' => $settings->coin_timeout_seconds,
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'standard_duration_min' => 'required|integer|min:1|max:180',
            'standard_price' => 'required|numeric|min:1',
            'premium_duration_min' => 'required|integer|min:1|max:180',
            'premium_price' => 'required|numeric|min:1',
            'coin_timeout_seconds' => 'required|integer|min:1|max:120',
        ]);

        $settings = VendoSetting::config();
        $settings->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'user' => $request->user()->full_name,
            'ip_address' => $request->ip(),
            'action' => 'VENDO_CONFIG',
            'details' => 'Updated the vending machine: Standard cycle ₱' . number_format($validated['standard_price'], 2)
                . ' for ' . $validated['standard_duration_min'] . ' minutes, Premium cycle ₱' . number_format($validated['premium_price'], 2)
                . ' for ' . $validated['premium_duration_min'] . ' minutes, coin collection window ' . $validated['coin_timeout_seconds'] . ' seconds',
        ]);

        return response()->json([
            'success' => true,
            ...$settings->only([
                'standard_duration_min', 'standard_price',
                'premium_duration_min', 'premium_price',
                'coin_timeout_seconds',
            ]),
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
