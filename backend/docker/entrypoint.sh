#!/bin/sh
set -e

BIND_PORT="${PORT:-8000}"

# First boot without a real .env: scaffold from the example so artisan works.
# Railway supplies real values as environment variables, which always win.
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Generate APP_KEY only if one isn't already set (safe across restarts).
php artisan key:generate --no-interaction || true

# Composer built vendor/ with --no-scripts; register packages now.
php artisan package:discover --no-interaction || true

# Make sure the schema is current before serving.
php artisan migrate --force

# Baseline rows (facility, devices, first admin). Idempotent: the seeder never
# invents a default password - it applies ADMIN_PASSWORD when set, leaves an
# existing admin untouched when it isn't, and otherwise prints a generated one.
php artisan db:seed --force || true

# Expose the storage dir so uploaded files are web-served (idempotent).
php artisan storage:link --no-interaction || true

# Cache config/routes so first requests are fast and APP_DEBUG is honored.
php artisan config:cache --no-interaction || true
php artisan route:cache --no-interaction || true

# Bind Apache to the port the platform expects (Railway injects $PORT).
if [ -n "$BIND_PORT" ]; then
  sed -i "s/^Listen 80$/Listen ${BIND_PORT}/" /etc/apache2/ports.conf || true
  sed -i "s#<VirtualHost \*:80>#<VirtualHost *:${BIND_PORT}>#" /etc/apache2/sites-available/000-default.conf || true
fi

exec apache2-foreground