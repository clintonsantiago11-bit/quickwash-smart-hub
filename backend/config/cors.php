<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter([
        env('FRONTEND_URL'),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]),
    'allowed_origins_patterns' => [
        '~^https://.*\.vercel\.app$~',
        '~^http://localhost(:\d+)?$~',
        '~^http://127\.0\.0\.1(:\d+)?$~',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
