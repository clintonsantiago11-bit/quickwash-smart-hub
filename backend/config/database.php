<?php

/*
|--------------------------------------------------------------------------
| TLS
|--------------------------------------------------------------------------
|
| TiDB Serverless refuses any connection that is not encrypted, so the SSL
| options have to reach PDO with their real integer keys. PDO option
| constants are integers, and array_merge() renumbers integer keys — using it
| here silently turned ATTR_PERSISTENT into key 0 and the CA path into key 1,
| which meant no TLS at all and a boot failure on every deploy. The arrays
| below are combined with +, which preserves keys.
|
*/

$caPath = env('DB_SSL_CA', env('MYSQL_ATTR_SSL_CA', '/etc/ssl/certs/ca-certificates.crt'));
$sslEnabled = (bool) (env('DB_SSL_CA') || env('MYSQL_ATTR_SSL_CA') || file_exists($caPath));

$mysqlOptions = extension_loaded('pdo_mysql') ? array_filter([
    // Off by default. It cuts the per-request TLS handshake, which is worth
    // having on a 0.1 CPU instance, but it is opt-in so a problem with it
    // cannot reach production on its own. Turn it on with DB_PERSISTENT=true
    // once the connection has proved stable.
    PDO::ATTR_PERSISTENT => env('DB_PERSISTENT', false),

    PDO::MYSQL_ATTR_SSL_CA => $sslEnabled ? $caPath : null,
    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => $sslEnabled ? false : null,
], fn ($value) => $value !== null) : [];

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
            'options' => $mysqlOptions,
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_run' => true,
    ],
];
