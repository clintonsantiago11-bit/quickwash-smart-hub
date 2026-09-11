<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VendingTransaction;
use App\Models\WashLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function revenue(Request $request)
    {
        // Cap the window (1..90 days) so a huge `days` value can't produce
        // an unbounded aggregation query (DoS guard).
        $days = (int) max(1, min(90, (int) $request->get('days', 7)));
        $start = Carbon::now()->subDays($days - 1);

        $revenueData = VendingTransaction::where('transaction_time', '>=', $start)
            ->selectRaw('DATE(transaction_time) as day, SUM(amount) as revenue')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $washData = WashLog::where('completed_at', '>=', $start)
            ->selectRaw('DATE(completed_at) as day, COUNT(*) as washes')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $result = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i);
            $result[] = [
                'day' => $date->format('D'),
                'revenue' => (float) ($revenueData->get($date->format('Y-m-d'))->revenue ?? 0),
                'washes' => (int) ($washData->get($date->format('Y-m-d'))->washes ?? 0),
                'full_date' => $date->format('Y-m-d'),
            ];
        }

        return response()->json($result);
    }

    public function washes(Request $request)
    {
        return $this->revenue($request);
    }

    public function peakHours()
    {
        $hours = [];
        for ($h = 8; $h <= 20; $h++) {
            $count = WashLog::whereRaw('HOUR(completed_at) = ?', [$h])
                ->whereDate('completed_at', today())
                ->count();

            $hours[] = [
                'hour' => str_pad($h, 2, '0') . ':00',
                'volume' => $count,
            ];
        }

        return response()->json($hours);
    }
}
