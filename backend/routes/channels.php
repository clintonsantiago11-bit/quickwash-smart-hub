<?php

use Illuminate\Support\Facades\Broadcast;

// Only admin/manager roles may subscribe to hardware telemetry and alerts
Broadcast::channel('hardware.{deviceId}', function ($user, $deviceId) {
    return $user !== null && in_array($user->role, ['admin', 'manager']);
});

Broadcast::channel('alerts', function ($user) {
    return $user !== null && in_array($user->role, ['admin', 'manager']);
});