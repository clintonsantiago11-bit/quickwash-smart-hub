<?php

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Single source of truth for which browser origins may call this API. Set
| FRONTEND_URL to the deployed dashboard origin; local dev origins are
| appended so `php artisan serve` works without extra config.
|
| An explicit allowlist is deliberate. A wildcard or a "*.vercel.app"
| pattern would let any deployment on that platform make credentialed
| cross-origin calls to this API, so neither is used here.
|
*/

$local = array_filter([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // The camera proxy in the dashboard is same-origin, but keep the API's
    // own port open for anyone hitting it from a local dev server.
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]);

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        [env('FRONTEND_URL')],
        $local,
    )))),
    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-API-Key'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => true,
];
