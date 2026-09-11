<?php

namespace App\Services;

use App\Broadcasting\HardwareUpdate;
use App\Models\Alert;
use App\Models\Device;
use App\Models\SensorLog;
use App\Models\VendingTransaction;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

class MqttService
{
    protected string $host;
    protected int $port;
    protected string $clientId;
    protected string $topicPrefix;
    protected $client = null;

    public function __construct()
    {
        $this->host = config('mqtt.host');
        $this->port = config('mqtt.port');
        $this->clientId = config('mqtt.client_id') . '_' . uniqid();
        $this->topicPrefix = config('mqtt.topic_prefix');
    }

    public function connect(): bool
    {
        $address = "tcp://{$this->host}:{$this->port}";
        $this->client = @stream_socket_client($address, $errno, $errstr, 15);

        if (!$this->client) {
            Log::warning("MQTT connection failed: {$errstr} ({$errno})");
            return false;
        }

        $connectPacket = $this->buildConnectPacket();
        fwrite($this->client, $connectPacket);
        $response = fread($this->client, 4);

        // Validate the CONNACK: first byte must be 0x20 and the return code
        // (4th byte) must be 0 (connection accepted).
        if (strlen($response) < 4 || (ord($response[0]) & 0xF0) !== 0x20 || ord($response[3]) !== 0) {
            Log::warning('MQTT broker rejected connection');
            fclose($this->client);
            $this->client = null;
            return false;
        }

        Log::info("MQTT connected to {$this->host}:{$this->port}");
        return true;
    }

    public function subscribe(string $topic, int $qos = 0): void
    {
        if (!$this->client) return;

        $packetId = rand(1, 65535);
        $topicLength = strlen($topic);
        $packet = chr(0x82) . chr(2 + 2 + $topicLength + 1);
        $packet .= chr($packetId >> 8) . chr($packetId & 0xFF);
        $packet .= chr($topicLength >> 8) . chr($topicLength & 0xFF) . $topic;
        $packet .= chr($qos);

        fwrite($this->client, $packet);
        Log::info("MQTT subscribed to: {$topic}");
    }

    public function publish(string $topic, string $message, int $qos = 0): void
    {
        if (!$this->client) return;

        $topicLength = strlen($topic);
        $messageLength = strlen($message);
        $packetIdBytes = $qos > 0 ? 2 : 0;
        $remainingLength = 2 + $topicLength + $packetIdBytes + $messageLength;
        $packet = chr(0x30 | ($qos << 1)) . $this->encodeRemainingLength($remainingLength);
        $packet .= chr($topicLength >> 8) . chr($topicLength & 0xFF) . $topic;
        if ($qos > 0) {
            $packetId = rand(1, 65535);
            $packet .= chr($packetId >> 8) . chr($packetId & 0xFF);
        }
        $packet .= $message;

        fwrite($this->client, $packet);
    }

    public function listen(callable $callback): void
    {
        if (!$this->client) return;

        while (!feof($this->client)) {
            $byte = fread($this->client, 1);
            if ($byte === false || $byte === '') break;

            $byteVal = ord($byte);
            $remainingLength = 0;
            $multiplier = 1;

            do {
                $byte = fread($this->client, 1);
                if ($byte === false || $byte === '') break 2;
                $digit = ord($byte);
                $remainingLength += ($digit & 127) * $multiplier;
                $multiplier *= 128;
                if ($multiplier > 128 * 128 * 128) break 2;
            } while ($digit & 128);

            $payload = fread($this->client, $remainingLength);

            $packetType = $byteVal >> 4;

            if ($packetType === 3) { // PUBLISH
                $topicLength = (ord($payload[0]) << 8) | ord($payload[1]);
                $topic = substr($payload, 2, $topicLength);
                $message = substr($payload, 2 + $topicLength);

                $callback($topic, $message);
            } elseif ($packetType === 13) { // PINGRESP
                // Keep alive
            }

            // Send ping every iteration
            fwrite($this->client, chr(0xC0) . chr(0x00));
        }
    }

    public function disconnect(): void
    {
        if ($this->client) {
            fwrite($this->client, chr(0xE0) . chr(0x00));
            fclose($this->client);
            $this->client = null;
            Log::info("MQTT disconnected");
        }
    }

    public function isConnected(): bool
    {
        return $this->client !== null && !feof($this->client);
    }

    public function handleMessage(string $topic, string $message): void
    {
        $data = json_decode($message, true);
        if (!$data) {
            Log::warning("Invalid MQTT message on {$topic}: {$message}");
            return;
        }

        $parts = explode('/', $topic);
        $category = $parts[2] ?? '';
        $deviceId = $parts[3] ?? '';
        $detail = $parts[4] ?? '';

        // Update device status (create with safe defaults so NOT NULL columns are satisfied)
        try {
            Device::updateOrCreate(
                ['id' => $deviceId],
                [
                    'name' => $deviceId,
                    'type' => 'controller',
                    'facility_id' => 1,
                    'status' => 'online',
                    'last_seen' => now(),
                ]
            );
        } catch (\Exception $e) {
            Log::warning("Failed to update device status: {$e->getMessage()}");
        }

        // Broadcast to Reverb for real-time frontend updates
        try {
            $event = new HardwareUpdate($deviceId, $topic, $data);
            broadcast($event);
        } catch (\Exception $e) {
            Log::debug("Broadcast failed (Reverb may not be running): {$e->getMessage()}");
        }

        switch ($category) {
            case 'sensor':
                $this->handleSensorData($deviceId, $detail, $data);
                break;
            case 'alert':
                $this->handleAlert($deviceId, $data);
                break;
            case 'status':
                $this->handleStatus($deviceId, $data);
                break;
        }
    }

    protected function handleSensorData(string $deviceId, string $detail, array $data): void
    {
        $sensorData = ['device_id' => $deviceId];

        if ($detail === 'levels') {
            $sensorData['water_level'] = $data['water'] ?? null;
            $sensorData['soap_a_level'] = $data['soap_a'] ?? null;
            $sensorData['soap_b_level'] = $data['soap_b'] ?? null;
            $sensorData['wax_level'] = $data['wax'] ?? null;
        } elseif ($detail === 'flow_temp') {
            $sensorData['flow_rate'] = $data['flow_lpm'] ?? null;
            $sensorData['temperature'] = $data['temp_c'] ?? null;
        } elseif ($detail === 'vending' && ($data['event'] ?? '') === 'coin_inserted') {
            VendingTransaction::create([
                'device_id' => $deviceId,
                'amount' => $data['amount'] ?? 0,
                'payment_method' => 'coin',
            ]);
            return;
        }

        if (count($sensorData) > 1) {
            SensorLog::create($sensorData);
        }
    }

    protected function handleAlert(string $deviceId, array $data): void
    {
        Alert::create([
            'device_id' => $deviceId,
            'type' => $data['type'] ?? 'SYSTEM_ALERT',
            'severity' => $data['severity'] ?? 'warning',
            'message' => $data['message'] ?? '',
        ]);
    }

    protected function handleStatus(string $deviceId, array $data): void
    {
        if (($data['status'] ?? '') === 'error') {
            Alert::create([
                'device_id' => $deviceId,
                'type' => 'JAM_ERROR',
                'severity' => 'critical',
                'message' => 'Motor resistance detected on roller assembly',
            ]);
        }
    }

    protected function buildConnectPacket(): string
    {
        $protocolName = "\x00\x04MQTT";
        $protocolLevel = chr(0x04);
        $connectFlags = chr(0x02);
        $keepAlive = chr(0x00) . chr(60);

        $clientIdLength = strlen($this->clientId);
        $clientIdPacket = chr($clientIdLength >> 8) . chr($clientIdLength & 0xFF) . $this->clientId;

        $remainingLength = strlen($protocolName) + 1 + 1 + 2 + strlen($clientIdPacket);
        $fixedHeader = chr(0x10) . $this->encodeRemainingLength($remainingLength);

        return $fixedHeader . $protocolName . $protocolLevel . $connectFlags . $keepAlive . $clientIdPacket;
    }

    protected function encodeRemainingLength(int $length): string
    {
        $encoded = '';
        do {
            $digit = $length % 128;
            $length = intdiv($length, 128);
            if ($length > 0) $digit |= 128;
            $encoded .= chr($digit);
        } while ($length > 0);
        return $encoded;
    }
}
