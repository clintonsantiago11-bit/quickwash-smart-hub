<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Allows this project's Vercel preview deployments to call this API.
 *
 * Each push mints a new hashed origin (quickwash-<hash>-<branch>.vercel.app),
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
 * The pattern is read from config('cors.allowed_origin_patterns') rather than
 * repeated here, so there is one place that decides which Vercel origins are
 * welcome. It used to be duplicated, and the copy in this file matched ANY
 * *.vercel.app - every project on Vercel, not this one. Deriving it from the
 * configured FRONTEND_URL narrows it to this project and its previews.
 *
 * On safety, and correcting the note that used to live here: this middleware
 * sets Access-Control-Allow-Credentials: true, matching config/cors.php,
 * which does enable credentials. That is not what makes it safe. Credentials
 * are set because the dashboard fetches with credentials:'include' and the
 * browser discards a credentialed response that lacks the header. What makes
 * it safe is that this API does not authenticate with a cookie the browser
 * attaches automatically - every request carries an Authorization: Bearer
 * header built from a token in the dashboard's localStorage, which a foreign
 * origin cannot read - and the only cookie it does set, auth_token, is
 * SameSite=Lax, so a cross-site request never returns it. A hostile origin can
 * therefore reach this API but has no session to present and gets 401.
 *
 * Do not turn that around by enabling Sanctum's stateful cookie auth
 * (SANCTUM_STATEFUL_DOMAINS) while this pattern is in place.
 */
class AllowVercelPreviewOrigins
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $origin = (string) $request->headers->get('Origin');

        if ($origin === '') {
            return $response;
        }

        $patterns = (array) config('cors.allowed_origin_patterns', []);
        $matched = false;
        foreach ($patterns as $pattern) {
            // fruitcake/php-cors applies these with preg_match, so they are real
            // regular expressions rather than globs.
            if (@preg_match((string) $pattern, $origin) === 1) {
                $matched = true;
                break;
            }
        }

        if (! $matched) {
            return $response;
        }

        // Only fill a gap. If the configured allowlist already permits this
        // origin, HandleCors has answered and this stays out of the way.
        if (! $response->headers->has('Access-Control-Allow-Origin')) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);

            // Required as well. The dashboard fetches with
            // credentials: 'include' and the browser discards the entire
            // response without this header, so omitting it looks like it works
            // right up until sign-in fails. config/cors.php sets
            // supports_credentials for the same reason.
            $response->headers->set('Access-Control-Allow-Credentials', 'true');

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