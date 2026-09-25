# QuickWash Smart Hub

IoT monitoring + control dashboard for a coin-operated carwash: ESP32 nodes and a
NAEK 3-in-1 timer on the wash-bay LAN, a Laravel API in the cloud, a Next.js
dashboard for owners/technicians, and an edge agent that bridges the LAN-only
hardware to the internet.

## Architecture

```
[NAEK timer / ESP32 nodes] --hotspot/LAN--> [carwash PC: iot-bridge edge agent]
                                                        |
                                                 outbound HTTPS (no port forwarding)
                                                        v
                                             [Laravel API + MySQL]  <--  [Next.js dashboard]
```

- **backend/** — Laravel 11 API (Sanctum tokens, role-gated writes, throttling, audit log).
- **frontend/** — Next.js 16 dashboard (App Router, Tailwind v4, Socket.IO live cards).
- **iot-bridge/** — Node edge agent on the carwash PC: polls the NAEK device and
  writes either to local MySQL (`NAEK_SINK=db`) or to the cloud API (`NAEK_SINK=api`).
- **firmware/** — Arduino sketches for the ESP32 controller, camera and vending node.
- **backups/** — local `mysqldump` output (gitignored); see `BACKUP_DB.bat`.

## Local development (₱0 demo)

1. Start XAMPP (Apache + MySQL) and make sure the `quickwash_hub` database is imported.
2. API: `cd backend && php artisan serve` (http://localhost:8000, health at `/api/health`).
3. Dashboard: `cd frontend && npm run dev` (http://localhost:3000).
4. Edge agent: `cd iot-bridge && cp .env.example .env && node index.js`.
5. Sign in with the seeded admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD` in
   `backend/.env`; if unset, the seeder prints a generated password once).

## Quality gate

```powershell
powershell -ExecutionPolicy Bypass -File run-gate.ps1
```

Runs backend PHPUnit (dedicated test DB), the frontend type check, ESLint and the
production `next build`. Exit code 0 = deployable.

## Deploy

Step-by-step PaaS instructions (Railway: MySQL + API container + dashboard) live in
[DEPLOY.md](DEPLOY.md). Production templates: `backend/.env.production.example`,
`frontend/.env.production.example`.

## Secrets

`.env` files are gitignored and must never be committed — only the `.example`
templates are tracked. Generate fresh `APP_KEY`, `NAEK_INGEST_KEY` and
`BRIDGE_API_KEY` values for production; never reuse local development keys.
