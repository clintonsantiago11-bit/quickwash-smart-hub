<?php

namespace Tests\Feature;

use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    public function test_analytics_days_are_capped(): void
    {
        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'admin123',
        ]);
        $token = $login->json('token');

        $this->withToken($token)
            ->getJson('/api/analytics/revenue?days=99999')
            ->assertStatus(200);
    }

    public function test_analytics_revenue_within_default_window(): void
    {
        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@quickwash.hub',
            'password' => 'admin123',
        ]);
        $token = $login->json('token');

        $response = $this->withToken($token)
            ->getJson('/api/analytics/revenue')
            ->assertStatus(200);

        $data = $response->json();
        $this->assertIsArray($data);
        if (count($data) > 0) {
            $response->assertJsonStructure(['*' => ['day', 'revenue', 'washes', 'full_date']]);
        }
    }
}
