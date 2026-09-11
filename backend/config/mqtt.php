<?php

return [
    'host' => env('MQTT_BROKER_HOST', 'broker.hivemq.com'),
    'port' => env('MQTT_BROKER_PORT', 1883),
    'client_id' => env('MQTT_CLIENT_ID', 'quickwash_backend'),
    'topic_prefix' => env('MQTT_TOPIC_PREFIX', 'quickwash/quickwash_main'),
];
