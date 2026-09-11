@echo off
title QuickWash Smart Hub - Backend
echo ============================================
echo  QuickWash Smart Hub - Backend Server
echo ============================================
echo.
echo [1/3] Installing dependencies...
call C:\xampp\php\php.exe C:\xampp\php\composer.phar install --no-interaction
if %errorlevel% neq 0 (
    echo ERROR: Composer install failed
    pause
    exit /b 1
)
echo.
echo [2/3] Generating app key (only if missing)...
if not exist .env (
    copy .env.example .env
)
C:\xampp\php\php.exe artisan key:generate --no-interaction
echo.
echo [3/3] Running database migrations and seeding...
C:\xampp\php\php.exe artisan migrate --force
C:\xampp\php\php.exe artisan db:seed --force
echo.
echo ============================================
echo  Starting API Server on http://localhost:8000
echo ============================================
echo.
C:\xampp\php\php.exe artisan serve --host=localhost --port=8000
pause