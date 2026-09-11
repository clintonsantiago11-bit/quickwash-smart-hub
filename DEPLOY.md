# QuickWash Smart Hub — Deployment Guide

## Architecture (why it deploys this way)

The NAEK timer is a LAN-only device (its own WiFi hotspot, page at `192.168.4.1`).
It can never be reached from the internet, so the cloud NEVER talks to it.
Instead, an **edge agent** runs on the carwash PC, polls the device, and pushes
data UP to the cloud (outbound HTTPS only — works behind any router/CGNAT, no
port forwarding).

```
[NAEK device] --hotspot--> [carwash PC: naek-agent] --outbound HTTPS--> [Cloud: Laravel API + MySQL]
                                                                              |
                                                                        [Vercel: Next.js dashboard]
```

## Local demo (today, ₱0)

1. Start XAMPP (Apache + MySQL), `quickwash_hub` imported
2. PC WiFi -> NAEK hotspot (`Empoy Carwash Vendo`)
3. `cd iot-bridge && node index.js` (reads `.env`; `NAEK_SINK=db` writes local MySQL)
4. `php artisan serve` + `npm run dev` — dashboard at localhost:3000, vendo page shows the live NAEK card

## Cloud deploy (Pattern A)

### 1. Backend (Hostinger / any PHP host)
- Upload `backend/`, run `composer install --no-dev`, `php artisan migrate --force`
- Set in `.env`: `APP_URL=https://api.yourdomain.com`, `FRONTEND_URL=https://yourdomain.com`,
  `NAEK_INGEST_KEY=<the key from iot-bridge/.env>`, `APP_ENV=production`, `APP_DEBUG=false`
- Point the carwash PC's `iot-bridge/.env`:
  - `NAEK_SINK=api`
  - `NAEK_API_URL=https://api.yourdomain.com/api`
  - `NAEK_API_KEY=<same key>`

### 2. Frontend (Vercel)
- Import the `frontend/` repo, set env:
  - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`
  - `NEXT_PUBLIC_WS_URL=https://bridge.yourdomain.com` (see below)

### 3. IoT bridge (carwash PC, always on)
- Run `node index.js` (e.g. via pm2: `pm2 start index.js --name quickwash-bridge`)
- The bridge ALSO serves Socket.IO live updates. For a public dashboard, either:
  - Run the bridge on a small VPS WITH the MQTT connection, OR
  - Keep the bridge local and expose only its socket via a Cloudflare Tunnel:
    `cloudflared tunnel --url http://localhost:3001` -> use the URL as `NEXT_PUBLIC_WS_URL`

## Security checklist (done / do-at-deploy)

- [x] Bridge CORS allowlist (`CORS_ORIGINS` env, no `*`)
- [x] Laravel CORS via `FRONTEND_URL` env
- [x] NAEK ingest protected by rotated API key (`NAEK_API_KEY` / `NAEK_INGEST_KEY`)
- [x] Secrets only in `.env` (`.env.example` committed, `.env` gitignored — verify before push)
- [ ] Replace public MQTT broker (`broker.hivemq.com`) with authenticated
      HiveMQ Cloud / EMQX (free tier) — anyone can read/write public topics today
- [ ] Force HTTPS (`APP_URL`, Vercel default) and `wss://` socket URL
- [ ] Camera MJPEG: plain-HTTP streams are blocked on HTTPS pages — keep using the
      Next.js `/api/camera` proxy route, never the camera's raw URL in the browser

## Notes

- All timestamps are stored PH-local (`config/app.php` timezone = Asia/Manila)
- `NAEK_POLL_MS` minimum is 5000; 15000 is a good default (30s cycles won't be missed)
- When the carwash PC is offline, the dashboard shows the device as offline and
  keeps historical data — sales sync resumes on the next poll (usage deltas are
  computed against the last seen snapshot, so nothing is double-counted)
