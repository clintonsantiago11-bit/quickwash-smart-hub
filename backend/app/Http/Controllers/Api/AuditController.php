<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\AuditRetention;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AuditController extends Controller
{
    /**
     * What the retention job is about to do.
     *
     * Deleting audit rows cannot be undone, so the dashboard asks here rather
     * than discovering it afterwards. Cached briefly because it runs two
     * counts and the answer only changes once a day, when the prune runs.
     */
    public function retention(Request $request)
    {
        $days = max(1, min(3650, $request->integer('days', AuditRetention::DEFAULT_DAYS)));

        return response()->json(
            Cache::remember("audit.retention.{$days}", 300, fn () => AuditRetention::preview($days))
        );
    }

    public function index(Request $request)
    {
        $query = AuditLog::orderBy('created_at', 'desc');

        // Filter by action type (LOGIN, DEVICE_COMMAND, WASH_COMPLETED, ...)
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        // Free-text search over user / details / ip
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('user', 'like', "%{$search}%")
                    ->orWhere('details', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        $perPage = min(50, max(1, $request->integer('limit', 10)));
        $page = max(1, $request->integer('page', 1));

        // The page count used to be COUNT(*) over the whole table on every
        // single request, including paging, which is the one thing a growing
        // trail makes expensive. Cached per filter/search for a minute: the
        // number is only used to draw the pager, so a minute of staleness is
        // invisible, and a page turn no longer re-counts.
        $cacheKey = 'audit.total.' . sha1(json_encode([
            $request->input('action'),
            $request->input('search'),
            $perPage,
        ]));
        $total = Cache::remember($cacheKey, 60, fn () => (clone $query)->count());

        $logs = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user' => $log->user,
                    'ip' => $log->ip_address,
                    'action' => $log->action,
                    'details' => $log->details,
                    'time' => $log->created_at?->format('Y-m-d H:i:s') ?? '-',
                ];
            });

        return response()->json([
            'data' => $logs,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ]);
    }
}