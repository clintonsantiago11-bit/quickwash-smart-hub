<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Alert;
use App\Models\VendingTransaction;
use App\Models\SensorLog;
use App\Models\WashLog;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    /**
     * Seconds the dashboard summary is shared between callers.
     *
     * Every signed-in browser polls this every ten seconds, so a dozen
     * terminals means a dozen copies of the same nine queries. Caching for a
     * few seconds collapses that to one computation regardless of how many
     * people are watching, which is what makes a small instance viable. The
     * figures are revenue totals, wash counts and device heartbeats — none of
     * which change meaningfully in five seconds.
     */
    private const CACHE_SECONDS = 5;

    public function stats()
    {
        return response()->json(
            Cache::remember('dashboard.stats', self::CACHE_SECONDS, fn () => $this->buildStats())
        );
    }

    private function buildStats(): array
    {
        // A range on the raw column, not whereDate(). Wrapping the column in
        // DATE() means no index can ever be used, which turns these into full
        // scans of two of the busiest tables. See the query-index migration.
        $startOfToday = now()->startOfDay();
        $endOfToday = $startOfToday->copy()->addDay();
        $startOfYesterday = $startOfToday->copy()->subDay();

        $todayRevenue = (float) VendingTransaction::whereBetween('transaction_time', [$startOfToday, $endOfToday])->sum('amount');
        $yesterdayRevenue = (float) VendingTransaction::whereBetween('transaction_time', [$startOfYesterday, $startOfToday])->sum('amount');
        $revenueChange = $yesterdayRevenue > 0
            ? round((($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100)
            : null;

        $activeWashes = WashLog::whereBetween('completed_at', [$startOfToday, $endOfToday])->count();

        $totalBays = max(1, Device::where('type', 'controller')->count());

        // Must match the IoT bridge stale-sweeper grace window (90s) so a
        // slow heartbeat on the public broker never flickers the count
        $onlineCutoff = now()->subSeconds(90);
        $devicesOnline = Device::where('last_seen', '>=', $onlineCutoff)->count();
        $totalDevices = Device::count();
        $activeAlerts = Alert::where('resolved', false)->count();

        $latestLevels = SensorLog::where('device_id', 'esp32_bay_1')
            ->whereNotNull('water_level')
            ->orderByDesc('recorded_at')
            ->first();
        $latestFlowTemp = SensorLog::where('device_id', 'esp32_bay_1')
            ->whereNotNull('flow_rate')
            ->orderByDesc('recorded_at')
            ->first();

        return [
            'stats' => [
                ['label' => "Today's Revenue", 'value' => "₱" . number_format($todayRevenue, 2), 'change' => $revenueChange === null ? null : (($revenueChange >= 0 ? '+' : '') . $revenueChange . '% vs yesterday')],
                ['label' => 'Active Washes', 'value' => (string) $activeWashes, 'subValue' => "/ {$totalBays} bays"],
                ['label' => 'Devices Online', 'value' => (string) $devicesOnline, 'subValue' => "/ {$totalDevices}"],
                ['label' => 'Active Alerts', 'value' => (string) $activeAlerts],
            ],
            'supplies' => [
                ['label' => 'Water Tank', 'level' => $latestLevels?->water_level, 'color' => '#00B4D8'],
                ['label' => 'Soap Tank A', 'level' => $latestLevels?->soap_a_level, 'color' => '#F6AD55'],
                ['label' => 'Soap Tank B', 'level' => $latestLevels?->soap_b_level, 'color' => '#00F5A0'],
            ],
            'flow_rate' => $latestFlowTemp?->flow_rate,
            'temperature' => $latestFlowTemp?->temperature,
        ];
    }
}
