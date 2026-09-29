<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        // Laravel 11 puts throttle:api (60/min per user or IP) on the whole
        // api group, and the array cache driver is shared for the entire
        // suite. Without this, a limit tripped in one test leaks into every
        // test that follows and they fail with unexplained 429s.
        RateLimiter::clear('api');
        Cache::flush();
    }

    /**
     * Every $this->get()/postJson() reuses the same application container, so a
     * guard resolved for an earlier request stays memoised. Without this, a
     * later request appears authenticated no matter what headers it carries,
     * and a test asserting "this token was revoked" silently passes instead of
     * failing. Real HTTP requests each get a fresh container, so forgetting
     * the guards is what mirrors production.
     */
    protected function forgetGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    /** Performs a request as the holder of a Sanctum bearer token. */
    protected function asToken(string $plainTextToken)
    {
        $this->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $plainTextToken);
    }

    /** Performs a request with no credentials at all. */
    protected function asAnonymous()
    {
        $this->forgetGuards();

        return $this->withHeader('Authorization', '');
    }
}
