<?php

use Illuminate\Http\Request;

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Deployment platforms (Railway, Render, etc.) sit in front of the app as
    | a reverse proxy / load balancer. Without trusting them, request->ip()
    | and scheme detection would report the proxy instead of the visitor,
    | which breaks login lockouts, audit logs and HTTPS redirect handling.
    | '*' trusts all proxies; tighten to specific IPs on your own hardware.
    |
    */

    'proxies' => env('TRUSTED_PROXIES', '*'),

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxy Headers
    |--------------------------------------------------------------------------
    |
    | Forwarded For / Host / Port / Proto are the standard load-balancer
    | headers; trusting them lets Laravel rebuild the real client request.
    |
    */

    'headers' => Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO,
];