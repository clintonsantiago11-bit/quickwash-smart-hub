<?php

use Illuminate\Http\Request;

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Railway, Render and similar platforms sit in front of the app as a reverse
    | proxy / load balancer. Without trusting them, request->ip() and scheme
    | detection would report the proxy instead of the visitor, which breaks
    | login lockouts, audit logs and HTTPS redirect handling.
    |
    | On Render '*' is the practical choice: the service is only reachable
    | through Render's own proxy, which overwrites X-Forwarded-For with the
    | real client address, so the IP used for lockouts is genuine.
    |
    | Two things to know before loosening it elsewhere:
    |  - On a host that IS directly reachable, '*' lets a client spoof its IP
    |    with a forged X-Forwarded-For, which would let an attacker walk past
    |    the per-IP half of the login lockout.
    |  - Behind a shared NAT or carrier network, every user shares one IP, so
    |    a lockout triggered by one person locks out everyone behind that IP.
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