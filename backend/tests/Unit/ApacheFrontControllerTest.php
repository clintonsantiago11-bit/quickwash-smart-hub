<?php

namespace Tests\Unit;

use Tests\TestCase;

class ApacheFrontControllerTest extends TestCase
{
    public function test_apache_routes_missing_files_to_the_laravel_front_controller(): void
    {
        $htaccess = public_path('.htaccess');

        $this->assertFileExists($htaccess);
        $this->assertStringContainsString('RewriteEngine On', file_get_contents($htaccess));
        $this->assertStringContainsString('RewriteCond %{REQUEST_FILENAME} !-f', file_get_contents($htaccess));
        $this->assertStringContainsString('RewriteRule ^ index.php [L]', file_get_contents($htaccess));
    }
}
