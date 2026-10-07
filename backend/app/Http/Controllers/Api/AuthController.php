<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Max failed attempts before the account is temporarily locked. */
    protected const MAX_ATTEMPTS = 5;

    /** Lockout window (minutes) once the attempt limit is reached. */
    protected const LOCKOUT_MINUTES = 15;

    /** Sliding window (minutes) over which attempts are counted. */
    protected const ATTEMPT_WINDOW_MINUTES = 15;

    /**
     * The lockout counters below live in the cache. On a platform with an
     * ephemeral filesystem a file-backed cache is wiped by every deploy and
     * every spin-down, which silently hands an attacker a fresh set of
     * attempts and makes this control look like it is working when it is not.
     * Say so loudly in the logs rather than fail the request.
     */
    private function warnIfLockoutWillNotSurviveARestart(): void
    {
        if (config('cache.default') !== 'file') {
            return;
        }

        Log::warning(
            'Login lockout is using the file cache on what looks like an ephemeral '
            . 'filesystem. Failed-attempt counters will reset on every deploy or '
            . 'instance restart. Set CACHE_DRIVER=database.'
        );
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $this->warnIfLockoutWillNotSurviveARestart();

        // Brute-force lockout: keyed on (email + IP), independent of the
        // route-level throttle so a distributed attempt still trips a lock.
        $lockKey = 'login-lock:' . strtolower($request->email) . ':' . $request->ip();
        $attemptsKey = 'login-attempts:' . strtolower($request->email) . ':' . $request->ip();

        if (Cache::has($lockKey)) {
            $remaining = Cache::get($lockKey) - Carbon::now()->getTimestamp();
            throw ValidationException::withMessages([
                'email' => ["Too many failed attempts. Try again in " . max(1, (int) ceil($remaining / 60)) . " minute(s)."],
            ]);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            // Count the failure and lock when the threshold is hit.
            $attempts = (int) Cache::get($attemptsKey, 0) + 1;
            Cache::put($attemptsKey, $attempts, Carbon::now()->addMinutes(self::ATTEMPT_WINDOW_MINUTES));
            if ($attempts >= self::MAX_ATTEMPTS) {
                Cache::put($lockKey, Carbon::now()->addMinutes(self::LOCKOUT_MINUTES)->getTimestamp(), Carbon::now()->addMinutes(self::LOCKOUT_MINUTES));
                Cache::forget($attemptsKey);
            }

            AuditLog::create([
                'user' => 'Unknown',
                'ip_address' => $request->ip(),
                'action' => 'FAILED_LOGIN',
                'details' => "A sign-in attempt for '{$request->email}' was rejected (wrong email or password)",
            ]);

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Success resets the counter.
        Cache::forget($attemptsKey);
        Cache::forget($lockKey);

        $token = $user->createToken('quickwash-token')->plainTextToken;

        // Stamped on every sign-in so the profile can show when the operator
        // was last seen, instead of the placeholder the UI used to render.
        $user->forceFill(['last_login_at' => Carbon::now()])->save();

        AuditLog::create([
            'user_id' => $user->id,
            'user' => $user->full_name,
            'ip_address' => $request->ip(),
            'action' => 'LOGIN',
            'details' => "{$user->full_name} signed in successfully",
        ]);

        // Mirror the token into an HttpOnly cookie so the Next.js server-side
        // middleware (src/middleware.ts) can gate protected pages before they
        // render — and so the session survives a page refresh without the
        // token ever being readable by client-side JS. SameSite=Lax + host-only
        // means localhost:8000 and localhost:3000 (same site, different ports)
        // share it. Lifetime matches the Sanctum token expiry.
        $cookieMinutes = (int) config('sanctum.expiration', 480);
        $cookie = cookie(
            'auth_token', $token, $cookieMinutes, '/', null, null, true, 'lax'
        );

        return response()->json([
            'token' => $token,
            // facility_name is not a column on users. The sign-in greeting
            // names the facility an operator is now signed in to, so it is
            // resolved here rather than left for the client to guess from an
            // id it cannot look up.
            'user' => $user->setAttribute('facility_name', $user->facility?->name),
        ])->withCookie($cookie);
    }

    public function logout(Request $request)
    {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'user' => $request->user()->full_name,
            'ip_address' => $request->ip(),
            'action' => 'LOGOUT',
            'details' => "{$request->user()->full_name} signed out",
        ]);

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out'])
            ->withoutCookie('auth_token', '/');
    }

    public function user(Request $request)
    {
        return response()->json(
            $request->user()->load('facility')
                ->setAttribute('facility_name', $request->user()->facility?->name)
        );
    }
}
