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
            'options' => extension_loaded('pdo_mysql') ? (
                env('DB_SSL_CA') || env('MYSQL_ATTR_SSL_CA') || file_exists('/etc/ssl/certs/ca-certificates.crt') ? [
                    PDO::MYSQL_ATTR_SSL_CA => env('DB_SSL_CA', env('MYSQL_ATTR_SSL_CA', '/etc/ssl/certs/ca-certificates.crt')),
                    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
                ] : []
            ) : [],
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_run' => true,
    ],
];
