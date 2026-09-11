<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Ensure lazy-resolved console commands get the Laravel container set.
        // ContainerCommandLoader resolves commands directly from the container
        // without calling setLaravel(), which causes "Call to a member function
        // make() on null" when the command's run() method executes.
        $this->app->afterResolving(\Illuminate\Console\Command::class, function ($command, $app) {
            $command->setLaravel($app);
        });
    }
}
