<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\VendingController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\NaekIngestController;
use App\Http\Controllers\Api\NaekConfigController;

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/auth/user', [AuthController::class, 'user'])->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update'])->middleware('throttle:30,1');
    Route::put('/profile/preferences', [ProfileController::class, 'updatePreferences'])->middleware('throttle:30,1');

    Route::get('/devices', [DeviceController::class, 'index']);
    Route::get('/devices/{device}', [DeviceController::class, 'show']);
    Route::post('/devices/{device}/command', [DeviceController::class, 'sendCommand'])
        ->middleware('role:admin,manager', 'throttle:20,1');

    Route::get('/alerts', [AlertController::class, 'index']);
    Route::patch('/alerts/{alert}/resolve', [AlertController::class, 'resolve'])->middleware('role:admin,manager');

    Route::get('/vending/transactions', [VendingController::class, 'index']);
    Route::get('/vending/stats', [VendingController::class, 'stats']);
    Route::get('/vending/settings', [VendingController::class, 'settings']);
    Route::put('/vending/settings', [VendingController::class, 'updateSettings'])
        ->middleware('role:admin,manager', 'throttle:30,1');

    // NAEK device mirror: dashboard reads + edits (2-way sync via the agent)
    Route::get('/naek/config', [NaekConfigController::class, 'show']);
    Route::put('/naek/config', [NaekConfigController::class, 'update'])
        ->middleware('role:admin,manager', 'throttle:30,1');

    Route::get('/analytics/revenue', [AnalyticsController::class, 'revenue']);
    Route::get('/analytics/washes', [AnalyticsController::class, 'washes']);
    Route::get('/analytics/peak-hours', [AnalyticsController::class, 'peakHours']);

    Route::get('/audit-logs', [AuditController::class, 'index'])->middleware('role:admin');

    Route::get('/dashboard/stats', [App\Http\Controllers\Api\DashboardController::class, 'stats']);
});

// NAEK edge-agent ingest (machine -> API, shared-key auth, rate limited)
Route::post('/ingest/naek', [NaekIngestController::class, 'store'])
    ->middleware('throttle:60,1');

Route::get('/', function () {
    return response()->json([
        'name' => 'QuickWash Smart Hub API',
        'status' => 'online',
        'version' => '1.0.0',
        'health' => url('/api/health'),
        'frontend' => 'http://localhost:3000'
    ]);
});

Route::get('/health', function () {
    return response()->json(['status' => 'online', 'service' => 'QuickWash Smart Hub API']);
});

