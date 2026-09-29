<?php

return [

    /*
    |--------------------------------------------------------------------------
    | NAEK edge agent
    |--------------------------------------------------------------------------
    |
    | Shared secret used by the edge agent to authenticate against
    | POST /api/ingest/naek. It must match NAEK_API_KEY in iot-bridge/.env.
    |
    | There is deliberately NO default. The ingest endpoint is unauthenticated
    | apart from this key and writes sale telemetry into the revenue tables,
    | so an unset key makes the endpoint refuse traffic rather than fall back
    | to a value that is published in the repository.
    |
    */

    'naek' => [
        'ingest_key' => env('NAEK_INGEST_KEY'),
    ],

];
