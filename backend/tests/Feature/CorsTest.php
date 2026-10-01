<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * A wrong allowlist entry does not fail quietly — the browser just refuses
 * the request and the dashboard reports "QuickWash could not be reached" with
 * nothing useful to look at. These assert the actual preflight responses.
 */
class CorsTest extends TestCase
{
    private function preflight(string $origin): \Illuminate\Testing\TestResponse
    {
        return $this->withHeaders([
            'Origin' => $origin,
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type',
        ])->options('/api/auth/login');
    }

    private function allowedOriginFor(string $origin): ?string
    {
        return $this->preflight($origin)->headers->get('Access-Control-Allow-Origin');
    }

    public function test_the_deployed_dashboard_origin_is_allowed(): void
    {
        $origin = 'https://quickwash-smart-hub.vercel.app';
        $this->assertSame($origin, $this->allowedOriginFor($origin));
    }

    public function test_vercel_preview_deployments_are_allowed(): void
    {
        // These are minted per push, so they cannot be listed in config.
        foreach ([
            'https://quickwash-smart-0kww6f5vh-i-think1.vercel.app',
            'https://quickwash-smart-abc123-fix-login.vercel.app',
            'https://quickwash-smart-9x2m1-master.vercel.app',
        ] as $origin) {
            $this->assertSame($origin, $this->allowedOriginFor($origin), "preview must be allowed: {$origin}");
        }
    }

    public function test_local_development_origins_are_allowed(): void
    {
        foreach (['http://localhost:3000', 'http://127.0.0.1:3000'] as $origin) {
            $this->assertSame($origin, $this->allowedOriginFor($origin), "dev origin must be allowed: {$origin}");
        }
    }

    public function test_everything_else_is_refused(): void
    {
        foreach ([
            'https://evil.example.com',
            'https://quickwash-smart-hub.vercel.app.evil.com', // suffix trick
            'https://evil.vercel.app.attacker.net',            // lookalike subdomain
            'https://notvercel.app',
            'http://quickwash-smart-hub.vercel.app',          // plaintext must not slip in
            'null',
        ] as $origin) {
            $this->assertNull(
                $this->allowedOriginFor($origin),
                "must refuse {$origin}",
            );
        }
    }

    /**
     * This is what makes allowing a Vercel preview pattern acceptable. The
     * dashboard authenticates with a bearer token, so there is no cookie for a
     * foreign origin to ride on.
     */
    /**
     * The client fetches with credentials: 'include', and the browser
     * discards the entire response if this header is missing � which is what
     * made sign-in fail while the API itself kept returning 200 to anything
     * not enforcing CORS.
     */
    public function test_credentials_are_advertised_or_the_browser_drops_the_response(): void
    {
        $this->assertTrue(
            config('cors.supports_credentials'),
            'credentials must be advertised or the browser blocks every API response',
        );

        // Every origin that is allowed has to carry both headers. Laravel's
        // test client does not enforce CORS the way a browser does, so nothing
        // else in this suite would catch one being missing.
        foreach ([
            'https://quickwash-smart-hub.vercel.app',
            'https://quickwash-smart-0kww6f5vh-i-think1.vercel.app',
            'http://localhost:3000',
        ] as $origin) {
            $response = $this->preflight($origin);
            $this->assertSame($origin, $response->headers->get('Access-Control-Allow-Origin'), $origin);
            $this->assertSame('true', $response->headers->get('Access-Control-Allow-Credentials'), $origin);
        }
    }
    public function test_bearer_auth_still_crosses_origin(): void
    {
        $response = $this->preflight('https://quickwash-smart-hub.vercel.app');
        $this->assertStringContainsString(
            'Authorization',
            (string) $response->headers->get('Access-Control-Allow-Headers'),
        );
    }
}