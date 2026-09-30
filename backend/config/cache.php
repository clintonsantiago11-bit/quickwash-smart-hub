<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Cache Store
    |--------------------------------------------------------------------------
    |
    | The database store is the default on purpose.
    |
    | The sign-in brute-force lockout keeps its state in the cache, so this is
    | not a performance setting. A file-backed cache lives on the container's
    | filesystem, which on Render is ephemeral: every deploy, restart or spin
    | down throws the lockout counters away and hands an attacker a fresh set
    | of attempts. The cache tables already exist, so the database store works
    | with no extra migration.
    |
    | If CACHE_DRIVER is explicitly set in the environment it still wins, so
    | the deployment must not pin this to "file".
    |
    */

    'default' => env('CACHE_DRIVER', 'database'),

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
