<?php

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost:3000')),
    'guard' => ['web'],
    // Token lifetime in minutes (default 8h). Short expiry limits the blast
    // radius if a token ever leaks; the SPA re-authenticates on expiry.
    'expiration' => (int) env('SANCTUM_TOKEN_EXPIRATION', 480),
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', 'quickwash_'),
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
