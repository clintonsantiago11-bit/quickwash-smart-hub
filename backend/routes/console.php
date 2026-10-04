<?php

use App\Support\AuditRetention;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Artisan;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| The MQTT listener was previously registered here AND as an Artisan command
| class (app/Console/Commands/MqttBridge.php), causing duplicate consumers
| that wrote every sensor reading twice.
|
| The IoT Bridge (iot-bridge/index.js, Node.js) is now the single MQTT
| consumer: it writes to the database and forwards real-time updates to the
| frontend over Socket.IO. Start it with:
|
|   node iot-bridge/index.js
|
*/

Artisan::command('iot:bridge-status', function () {
    $this->info('MQTT ingestion is handled by the Node.js IoT Bridge (iot-bridge/index.js).');
    $this->info('Run: node iot-bridge/index.js');
})->describe('Show how to start the IoT Bridge');

/*
|--------------------------------------------------------------------------
| Audit retention
|--------------------------------------------------------------------------
|
| Keeps the trail bounded so it cannot grow without limit. The command warns
| for a week before it deletes anything, and the dashboard shows the same
| warning through GET /api/audit/retention so nobody discovers the cutoff
| from a missing row.
|
*/

Schedule::command('audit:prune')->dailyAt('02:40');
