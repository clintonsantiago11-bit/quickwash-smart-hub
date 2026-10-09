<?php

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Which browser origins may call this API.
|
| Origins come from FRONTEND_URL (the deployed dashboard) plus
| FRONTEND_URLS, a comma-separated list for anything else — a custom domain,
| a second frontend, a staging host.
|
| Vercel preview deployments get a fresh hashed URL on every push
| (<slug>-<hash>-<branch>.vercel.app), so they cannot be listed in advance.
| They are matched by pattern instead.
|
| The pattern is built from VERCEL_PROJECT_SLUG, which you set to your Vercel
| project's slug. It is deliberately NOT derived from FRONTEND_URL: production
| commonly sits on a custom domain or alias whose host does not share the
| project slug (here a production host of quickwash-smart-hub.vercel.app
| alongside previews of the form quickwash-smart-<hash>-<branch>.vercel.app),
| so deriving one from the other silently locks out every preview.
|
| If VERCEL_PROJECT_SLUG is unset there are no patterns at all and previews are
| refused. That is the safe default: an unset variable must not widen the
| allowlist.
|
| Residual risk worth stating plainly: Vercel previews are
| <slug>-<hash>-<branch> and nothing in the shape distinguishes a real preview
| from a different project whose name happens to start with the same slug. The
| pattern therefore admits quickwash-smart-evil.vercel.app as well. It does
| not admit attacker-victim.vercel.app, which is what the previous blanket
| *.vercel.app pattern allowed.
|
| The risk of a broad origin pattern combines with supports_credentials,
| because then any page could ride on the visitor's cookies. This API does
| not use cookies for authentication. Every request carries an
| Authorization: Bearer header built from the token in the dashboard's
| localStorage, and nothing is readable cross-origin except through a header
| the calling page does not have. So a hostile page can reach this API but has
| no session to present and gets 401.
|
| Set ALLOW_VERCEL_PREVIEWS=false to turn the pattern off and go back to a
| strict list.
|
*/

$local = array_filter([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]);

$extra = array_filter(array_map('trim', explode(',', (string) env('FRONTEND_URLS', ''))));

$origins = array_values(array_unique(array_filter(array_merge(
    [env('FRONTEND_URL')],
    $extra,
    $local,
))));

/**
 * Pattern for this project's Vercel previews, anchored on the project slug.
 *
 * The optional hyphen-suffixed group is what lets <slug>-<hash>-<branch>
 * through while still refusing a completely unrelated project.
 */
$slug = trim((string) env('VERCEL_PROJECT_SLUG', ''));
$slug = preg_match('/^[a-z0-9][a-z0-9-]*$/i', $slug) ? strtolower($slug) : '';

$patterns = env('ALLOW_VERCEL_PREVIEWS', true) && $slug !== ''
    ? ['#^https://' . preg_quote($slug, '#') . '(-[a-z0-9][a-z0-9-]*)?\.vercel\.app$#i']
    : [];

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $origins,
    'allowed_origin_patterns' => $patterns,
    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-API-Key'],
    'exposed_headers' => [],
    'max_age' => 86400,

    // The dashboard fetches with credentials: 'include', and the browser
    // refuses the whole response unless this header is present. Turning it off
    // looks stricter but is what broke sign-in: the fetch rejected and the UI
    // reported "QuickWash could not be reached".
    //
    // Credentials here do not mean the auth cookie can be ridden cross-origin.
    // auth_token is SameSite=Lax, so a cross-site XHR never carries it, and
    // Sanctum authenticates on the Authorization header anyway. A preview
    // deployment therefore gets a response with no session attached to it.
    'supports_credentials' => true,
];
