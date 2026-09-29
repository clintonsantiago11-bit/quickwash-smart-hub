<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\UpdatePreferencesRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\AuditLog;
use App\Models\Facility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    /**
     * The shape the dashboard is allowed to see. An explicit DTO rather than
     * the model, so a column added to `users` later cannot leak by default.
     */
    private function present($user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'designation' => $user->designation,
            'avatar_url' => $user->avatar_url,
            'role' => $user->role,
            'facility_id' => $user->facility_id,
            'facility_name' => $user->facility?->name,
            'is_dark_mode' => $user->is_dark_mode,
            'email_alerts' => $user->email_alerts,
            'timezone' => $user->timezone ?? 'Asia/Manila',
            'locale' => $user->locale ?? 'en',
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('facility');

        return response()->json($this->present($user));
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $before = ['email' => $user->email, 'phone' => $user->phone];

        $user->fill($request->profileAttributes());
        $user->save();

        $changed = [];
        if ($before['email'] !== $user->email) {
            $changed[] = 'email';
        }
        if ($before['phone'] !== $user->phone) {
            $changed[] = 'phone';
        }

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'UPDATE_PROFILE',
            'details' => $changed
                ? "{$user->full_name} updated their profile (" . implode(', ', $changed) . ')'
                : "{$user->full_name} updated their profile details",
        ]);

        return response()->json([
            'success' => true,
            'user' => $this->present($user->fresh()->load('facility')),
        ]);
    }

    public function updatePreferences(UpdatePreferencesRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->fill($request->validated());
        $user->save();

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'UPDATE_PREFERENCES',
            'details' => "{$user->full_name} updated their display and notification preferences",
        ]);

        return response()->json([
            'success' => true,
            'user' => $this->present($user->fresh()->load('facility')),
        ]);
    }

    /**
     * Change the caller's own password. Every other Sanctum token is revoked
     * so a session stolen before the change stops working immediately; the
     * token making this request survives so the user is not logged out.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['That is not your current password.'],
            ]);
        }

        $user->password_hash = Hash::make($request->password);
        $user->save();

        $currentId = $request->user()->currentAccessToken()?->id;
        $revoked = 0;
        foreach ($user->tokens as $token) {
            if ($token->id !== $currentId) {
                $token->delete();
                $revoked++;
            }
        }

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'CHANGE_PASSWORD',
            'details' => "{$user->full_name} changed their password"
                . ($revoked ? " and revoked {$revoked} other session(s)" : ''),
        ]);

        return response()->json([
            'success' => true,
            'revoked_sessions' => $revoked,
        ]);
    }

    /**
     * This operator's own recent history. Replaces the fabricated activity
     * feed the profile used to render, which invented security alerts.
     */
    public function activity(Request $request): JsonResponse
    {
        $limit = min(50, max(1, $request->integer('limit', 10)));

        $logs = AuditLog::where('user_id', $request->user()->id)
            ->whereIn('action', ['LOGIN', 'LOGOUT', 'UPDATE_PROFILE', 'UPDATE_PREFERENCES', 'CHANGE_PASSWORD'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($log) => [
                'id' => $log->id,
                'action' => $log->action,
                'details' => $log->details,
                'ip' => $log->ip_address,
                'time' => $log->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $logs]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();
        $file = $request->file('avatar');

        // Replace, don't accumulate: drop the previous file so avatars do not
        // pile up in storage across repeated saves.
        if ($user->avatar_url && str_starts_with($user->avatar_url, '/storage/avatars/')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar_url));
        }

        $path = $file->store('avatars', 'public');
        $url = Storage::disk('public')->url($path);
        $user->avatar_url = $url;
        $user->save();

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'UPDATE_PROFILE',
            'details' => "{$user->full_name} updated their profile photo",
        ]);

        return response()->json(['success' => true, 'avatar_url' => $url]);
    }

    /**
     * Facilities the operator can be assigned to, so the settings UI is not
     * a free-text field. Kept here rather than adding a facilities controller
     * because the dashboard only ever needs the list.
     */
    public function facilities(): JsonResponse
    {
        return response()->json([
            'data' => Facility::orderBy('name')->get(['id', 'name', 'status']),
        ]);
    }
}
