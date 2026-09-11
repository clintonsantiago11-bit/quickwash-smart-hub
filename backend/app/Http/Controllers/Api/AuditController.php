<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditController extends Controller
{
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
        $total = (clone $query)->count();

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