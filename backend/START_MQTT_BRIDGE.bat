@echo off
title QuickWash Smart Hub - IoT Bridge
echo ============================================
echo  QuickWash IoT Bridge - Hardware Listener
echo ============================================
echo.
cd /d "%~dp0..\iot-bridge"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)
echo Starting Node.js IoT Bridge (MQTT + Socket.IO)...
node index.js
pause