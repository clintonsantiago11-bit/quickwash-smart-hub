<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'quickwash_hub'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? (array_merge(
                [
                    // The API runs on a single small instance, so a fresh TCP
                    // and TLS handshake to TiDB on every request is a
                    // meaningful share of a very small CPU budget. Keeping the
                    // connection alive across requests removes that cost.
                    PDO::ATTR_PERSISTENT => env('DB_PERSISTENT', true),
                ],
                (env('DB_SSL_CA') || env('MYSQL_ATTR_SSL_CA') || file_exists('/etc/ssl/certs/ca-certificates.crt') ? [
                    PDO::MYSQL_ATTR_SSL_CA => env('DB_SSL_CA', env('MYSQL_ATTR_SSL_CA', '/etc/ssl/certs/ca-certificates.crt')),
                    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
                ] : [])
            )) : [],
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_run' => true,
    ],
];
