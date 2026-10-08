<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Password Hashing
    |--------------------------------------------------------------------------
    |
    | Cost 10 rather than Laravel's default of 12.
    |
    | The API runs on a Render free instance with 0.1 shared CPU. Measured in
    | production, a sign-in took about 6.7 seconds, and a request that skips
    | the hashing entirely took 28 milliseconds, so over 99% of the wait was
    | bcrypt. Each step up in cost doubles that, so cost 12 on this hardware
    | costs roughly 3x more wait time than cost 10 buys back.
    |
    | The trade is real: cost 10 is 4x cheaper to brute force than cost 12.
    | It is OWASP's recommended minimum rather than a comfortable margin,
    | which is the right line to sit on for an account that can command the
    | bay's pumps and relays.
    |
    | Raise it once the API is on hardware with a CPU to spare:
    |   BCRYPT_ROUNDS=12
    |
    */

    'driver' => env('HASH_DRIVER', 'bcrypt'),

    'bcrypt' => [
        'rounds' => (int) env('BCRYPT_ROUNDS', 10),
        'verify' => true,
        'limit' => null,
    ],

    'argon' => [
        'memory' => (int) env('ARGON_MEMORY', 65536),
        'threads' => (int) env('ARGON_THREADS', 1),
        'time' => (int) env('ARGON_TIME', 4),
        'verify' => true,
    ],

    /*
    | Laravel's own rehash_on_login hook is deliberately NOT set here.
    |
    | It belongs to the session guard, and this API authenticates with a
    | Sanctum token issued by AuthController, so that hook is never reached
    | and would have been a setting that looks like it upgrades stored
    | hashes and silently does nothing. The upgrade is done explicitly in
    | AuthController::login with Hash::needsRehash() instead.
    |
    */

];