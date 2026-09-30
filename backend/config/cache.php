<?php

/*
| The sign-in brute-force lockout keeps its counters in the cache, so the cache
| store is a security setting, not a performance one. A file-backed cache lives
| on the container's filesystem, which on Render is ephemeral: every deploy,
| restart or spin-down wipes the counters and hands an attacker a fresh set of
| attempts while the lockout still looks like it is working.
|
| So the store is chosen here rather than trusted from the environment. Setting
| CACHE_DRIVER=file in production is overridden, because a deployment should
| not be able to silently disable brute-force protection.
*/

$configured = env('CACHE_DRIVER', 'database');

$default = ($configured === 'file' && env('APP_ENV') === 'production')
    ? 'database'
    : $configured;

return [

    'default' => $default,

    'stores' => [

        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'database' => [
            'driver' => 'database',
            'connection' => env('DB_CACHE_CONNECTION'),
            'table' => env('DB_CACHE_TABLE', 'cache'),
            'lock_connection' => env('DB_CACHE_LOCK_CONNECTION'),
            'lock_table' => env('DB_CACHE_LOCK_TABLE', 'cache_locks'),
        ],

        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
            'lock_path' => storage_path('framework/cache/data'),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Cache Key Prefix
    |--------------------------------------------------------------------------
    |
    | Prefixed so a shared TiDB cluster cannot serve one app's cached value to
    | another if they ever share a database.
    |
    */

    'prefix' => env('CACHE_PREFIX', 'quickwashhub_cache'),

];
