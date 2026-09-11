<?php

namespace App\Broadcasting;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class HardwareUpdate implements ShouldBroadcast
{
    public string $deviceId;
    public array $data;
    public string $topic;

    public function __construct(string $deviceId, string $topic, array $data)
    {
        $this->deviceId = $deviceId;
        $this->topic = $topic;
        $this->data = $data;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("hardware.{$this->deviceId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'HardwareUpdate';
    }

    public function broadcastWith(): array
    {
        return [
            'topic' => $this->topic,
            'data' => $this->data,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
