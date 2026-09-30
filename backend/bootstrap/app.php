<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\AllowVercelPreviewOrigins;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

return Application::configure(basePath: __DIR__.'/..')
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['role' => CheckRole::class]);
        $middleware->redirectGuestsTo(fn () => '/');
        // Security headers on every response (CSP/HSTS/X-Frame-Options/etc.)
        $middleware->prependToGroup('api', SecurityHeaders::class);

        // Vercel preview deployments get a fresh hashed origin on every push
        // and cannot be listed in config/cors.php ahead of time. This has to
        // sit before HandleCors so it can add the header the CORS service
        // drops the pattern for. See the middleware for why it is not config.
        $middleware->prepend(AllowVercelPreviewOrigins::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        });
    })->create();
