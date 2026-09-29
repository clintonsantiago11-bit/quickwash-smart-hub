<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security headers on every API response.
 *
 * This API only ever returns JSON and proxied camera bytes, so the policy is
 * deliberately locked down: nothing may be loaded or framed from this origin.
 * That is the strongest mitigation for the fact that the dashboard keeps its
 * bearer token in localStorage — a token stolen by XSS still cannot be
 * exfiltrated to an attacker's origin, because the API refuses to load
 * anything at all.
 *
 * CORS is NOT handled here. config/cors.php owns the origin allowlist, and
 * this middleware deliberately passes OPTIONS through so Laravel's CORS
 * handler can answer the preflight. Duplicating that logic in two places is
 * how the two drifted apart previously.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // JSON API: no scripts, styles, frames, images or connections may be
        // loaded from this origin, by this origin's own pages or anyone else's.
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox"
        );
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        // An API is never legitimately framed by the dashboard.
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if (app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
