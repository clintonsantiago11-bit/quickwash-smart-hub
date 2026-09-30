<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Allows Vercel preview deployments to call this API.
 *
 * Each push mints a new hashed origin (project-<hash>-<branch>.vercel.app),
 * so previews cannot be listed in config/cors.php ahead of time. They are
 * matched here by pattern instead.
 *
 * This exists as its own middleware rather than as an entry in
 * config('cors.allowed_origin_patterns') because the CORS service Laravel
 * bundles does not pick that key up: after setOptions() runs with the config
 * array, its allowedOriginsPatterns is still empty, so the pattern silently
 * matches nothing and every preview is refused. Asserting the mechanism here
 * keeps it verifiable rather than a line of configuration that looks right and
 * does nothing.
 *
 * Safe only because supports_credentials is false in config/cors.php. The
 * dashboard authenticates with a bearer token from localStorage, which a
 * foreign origin cannot read, so allowing an origin lets it reach the API but
 * never with a session. Do not turn credentials back on without removing this.
 */
class AllowVercelPreviewOrigins
{
    /** Anchored so only a genuine vercel.app host matches. */
    private const PATTERN = '#^https://[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*\.vercel\.app$#i';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $origin = (string) $request->headers->get('Origin');

        if ($origin === '' || preg_match(self::PATTERN, $origin) !== 1) {
            return $response;
        }

        // Only fill a gap. If the configured allowlist already permits this
        // origin, HandleCors has answered and this stays out of the way.
        if (! $response->headers->has('Access-Control-Allow-Origin')) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            $response->headers->set(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key'
            );
            $response->headers->set('Access-Control-Max-Age', '86400');
            $response->headers->set('Vary', 'Origin, Access-Control-Request-Method');
        }

        return $response;
    }
}