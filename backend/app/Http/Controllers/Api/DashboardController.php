<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Alert;
use App\Models\VendingTransaction;
use App\Models\SensorLog;
use App\Models\WashLog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function stats()
    {
        $todayRevenue = (float) VendingTransaction::whereDate('transaction_time', today())->sum('amount');
        $yesterdayRevenue = (float) VendingTransaction::whereDate('transaction_time', Carbon::yesterday())->sum('amount');
        $revenueChange = $yesterdayRevenue > 0
            ? round((($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100)
            : null;

        $activeWashes = WashLog::whereDate('completed_at', today())->count();

        $totalBays = max(1, Device::where('type', 'controller')->count());

        // Must match the IoT bridge stale-sweeper grace window (90s) so a
        // slow heartbeat on the public broker never flickers the count
        $onlineCutoff = now()->subSeconds(90);
        $devicesOnline = Device::where('last_seen', '>=', $onlineCutoff)->count();
        $totalDevices = Device::count();
        $activeAlerts = Alert::where('resolved', false)->count();

        $latestLevels = SensorLog::where('device_id', 'esp32_bay_1')
            ->whereNotNull('water_level')
            ->latest('recorded_at')
            ->first();
        $latestFlowTemp = SensorLog::where('device_id', 'esp32_bay_1')
            ->whereNotNull('flow_rate')
            ->latest('recorded_at')
            ->first();

        return response()->json([
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
                ['label' => 'Wax Tank', 'level' => $latestLevels?->wax_level, 'color' => '#9F7AEA'],
            ],
            'flow_rate' => $latestFlowTemp?->flow_rate,
            'temperature' => $latestFlowTemp?->temperature,
        ]);
    }
}
