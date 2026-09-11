<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return response()->json($request->user());
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $user->update($request->only([
            'full_name', 'email', 'phone', 'designation'
        ]));

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'UPDATE_PROFILE',
            'details' => "{$user->full_name} updated their profile details",
        ]);

        return response()->json(['success' => true, 'user' => $user]);
    }

    public function updatePreferences(Request $request)
    {
        $user = $request->user();
        $user->update($request->only([
            'is_dark_mode', 'email_alerts'
        ]));

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'UPDATE_PREFERENCES',
            'details' => "{$user->full_name} updated their display and notification preferences",
        ]);

        return response()->json(['success' => true, 'user' => $user]);
    }
}
