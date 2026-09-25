# QuickWash Smart Hub — Deployment Guide

## Architecture (why it deploys this way)

The NAEK timer is a LAN-only device (its own WiFi hotspot, page at `192.168.4.1`).
It can never be reached from the internet, so the cloud NEVER talks to it.
Instead, an **edge agent** runs on the carwash PC, polls the device, and pushes
data UP to the cloud (outbound HTTPS only — works behind any router/CGNAT, no
port forwarding).

```
[NAEK device] --hotspot--> [carwash PC: iot-bridge] --outbound HTTPS--> [Cloud: Laravel API + MySQL]
                                                                                   |
                                                                             [Next.js dashboard]
```

The dashboard (browser) talks to the Laravel API and the Socket.IO bridge via
HTTPS. Authentication is a Sanctum Bearer token (stored in `localStorage`); the
server-side page gate uses the frontend-owned `qhs_session` cookie, so the site
works no matter which domain the API lives on.

## Recommended production stack (free to start)

**Platform: Railway** — one place for everything:

| Piece | How it runs on Railway | Cost |
|---|---|---|
| MySQL | Railway "Reloaded MySQL" plugin | ~$5/mo (or self-host a tiny MySQL container) |
| Laravel API | `backend/Dockerfile` (php 8.2 + Apache) | covered by credits |
| Next.js dashboard | Nixpacks auto-build → `npm run start` | covered by credits |
| Socket.IO bridge | optional; run the carwash bridge behind a Cloudflare Tunnel | free |

Railway gives a 30-day **Free Trial with $5 of credits (no credit card)**, then
a permanent Free plan ($1/mo credit, 1 vCPU / 0.5 GB per service) or Hobby
($5/mo incl. $5 usage). A dashboard + API fits comfortably in the trial period
and stays cheap after.

### Free domain, accessible by everyone

Every Railway service gets a free HTTPS URL you can share immediately:

- Frontend: `https://<your-app>.up.railway.app`
- Backend:  `https://<your-api>.up.railway.app`

No purchase needed — just create the project and share the URL. If you later
want a branded name (e.g. `quickwash.duckdns.org` or a real `.com` bought at
cost through Cloudflare at ~₱600/yr), Railway custom domains require Hobby+ or
you can front it with Cloudflare DNS. Start with the Railway URL.

---

## Step 0 — prepare a production branch

The repo currently lives only on this machine with no remote. Create a GitHub
(or GitLab) repo and push — Railway deploys from Git:

```bash
cd "C:\xampp\htdocs\xampp\Capstone Project\QuickWash-Smart-Hub"
git remote add origin https://github.com/<you>/quickwash-smart-hub.git
git add -A
git commit -m "Production readiness: PaaS packaging, env-driven URLs, fix cross-origin auth gate"
git push -u origin master
```

> Do NOT commit `.env` files (already gitignored). Commit
> `.env.production.example` files as documentation only.

## Step 1 — create the MySQL database

1. In Railway, **New Project → Provision MySQL** (the "Reloaded MySQL" plugin).
2. Copy the auto-generated variables Railway shows: `MYSQLHOST`, `MYSQLPORT`,
   `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`. You'll reference them below.

## Step 2 — deploy the Laravel API

1. **New Project → Empty → New Service → Deploy from GitHub**, pick
   `quickwash-smart-hub`.
2. Set **Service type = Backend**, **Root Directory = `backend`**.
   Railway auto-detects `Dockerfile` (via `backend/railway.json`).
3. Click **Deploy**, then add these **Environment variables** (reference the
   MySQL service variables with `${{MYSQL.MYSQLHOST}}` etc.):

   | Variable | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `APP_KEY` | generate once: `php -r "echo 'base64:'.base64_encode(random_bytes(32));"` |
   | `APP_DEBUG` | `false` |
   | `APP_URL` | `https://<your-api>.up.railway.app` (its own public URL) |
   | `FRONTEND_URL` | `https://<your-app>.up.railway.app` |
   | `DB_HOST` | `${{MYSQL.MYSQLHOST}}` |
   | `DB_PORT` | `${{MYSQL.MYSQLPORT}}` |
   | `DB_DATABASE` | `${{MYSQL.MYSQLDATABASE}}` |
   | `DB_USERNAME` | `${{MYSQL.MYSQLUSER}}` |
   | `DB_PASSWORD` | `${{MYSQL.MYSQLPASSWORD}}` |
   | `NAEK_INGEST_KEY` | `openssl rand -hex 24` (keep for Step 4) |
   | `ADMIN_EMAIL` | the first admin's email (e.g. `admin@quickwash.hub`) |
   | `ADMIN_PASSWORD` | a strong password - applied by the seeder on boot |
   | `SESSION_DRIVER` | `file` |
   | `CACHE_DRIVER` | `file` |
   | `TRUSTED_PROXIES` | `*` |

4. The container runs `php artisan migrate --force` and `php artisan db:seed
   --force` on boot — schema and baseline rows are created automatically, and no
   default password ships. If `ADMIN_PASSWORD` is unset the seeder prints a
   generated password once in the deploy logs. While `ADMIN_PASSWORD` stays set,
   it is authoritative: every boot re-applies it (remove the variable after the
   first login if you want in-app password changes to stick). Verify
   `GET https://<your-api>.up.railway.app/api/health` returns `{"status":"online"}`.

## Step 3 — deploy the Next.js dashboard

1. **New Service → Deploy from GitHub** (same repo), **Root Directory =
   `frontend`**. Nixpacks builds it and `frontend/railway.json` starts it with
   `npm run start`.
2. Environment variables (**build-time, must be set before first deploy**):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-api>.up.railway.app/api` |
   | `NEXT_PUBLIC_WS_URL` | URL of a live bridge (omit on first deploy) |
   | `NEXT_PUBLIC_CAMERA_CONTROL_URL` | leave empty on the cloud (LAN-only) |

3. Deploy. Health check uses `/login` (public, no auth). Share
   `https://<your-app>.up.railway.app`.

Cameras: the ESP32-CAM is on the wash-bay LAN, so a cloud dashboard shows it
as **offline** — correct and intentional. To see live feeds, serve the app on
the LAN (see local demo) or tunnel the LAN via Cloudflare and set
`CAMERA_STREAM_URL`/`CAMERA_HOST` on the frontend service.

## Step 4 — point the carwash PC's edge agent at the API

Edit `iot-bridge/.env` on the carwash PC (no redeploys needed):

```dotenv
NAEK_SINK=api
NAEK_API_URL=https://<your-api>.up.railway.app/api
NAEK_API_KEY=<the NAEK_INGEST_KEY from Step 2>
```

Run `node index.js` (e.g. via pm2). Sales/usage sync resumes automatically on
each poll; deltas are computed against the last snapshot so nothing is double
counted.

### Live vendo updates (optional)

The dashboard polls REST and works without the socket. For live vendo/NAEK
cards, expose the bridge either by running it as another Railway service
(requires the NAEK agent + API sink to match) or by tunneling the carwash
bridge: `cloudflared tunnel --url http://localhost:3001` and set
`NEXT_PUBLIC_WS_URL` to that URL.

---

## Local demo (unchanged, ₱0)

1. Start XAMPP (Apache + MySQL), `quickwash_hub` imported
2. PC WiFi -> NAEK hotspot (`Empoy Carwash Vendo`)
3. `cd iot-bridge && node index.js` (NAEK_SINK=db writes local MySQL)
4. `php artisan serve` + `npm run dev` — dashboard at localhost:3000

## Production security checklist

- [x] Frontend `qhs_session` auth gate (works cross-origin; Bearer is the real auth)
- [x] No default admin credential ships — the seeder takes `ADMIN_PASSWORD` or
      generates a random one and prints it once
- [x] Node runtime pinned for the dashboard build (`frontend/.nvmrc` + `engines`)
- [x] Laravel CORS restricted to `FRONTEND_URL` (env, no wildcard in production)
- [x] NAEK ingest protected by a rotated API key
- [x] `APP_DEBUG=false`, `TRUSTED_PROXIES=*` behind the platform LB
- [ ] Replace public MQTT broker (`broker.hivemq.com`) with authenticated
      HiveMQ Cloud / EMQX (free tier) — public topics are readable today
- [ ] Rotate the NAEK ingest key and set a fixed `APP_KEY` before going live
- [ ] Camera MJPEG stays behind the Next.js `/api/camera` proxy (never the raw
      camera URL) — required on HTTPS pages

## Notes

- All timestamps are stored PH-local (`config/app.php` timezone = Asia/Manila)
- `NAEK_POLL_MS` minimum is 5000; 15000 is a good default (30s cycles won't be missed)
- When the carwash PC is offline, the dashboard shows the device as offline and
  keeps historical data — sales sync resumes on the next poll.
- The dashboard's Node runtime is pinned (`frontend/.nvmrc` = 22, `engines.node`
  >= 20.9) because Next.js 16 requires Node 20.9 or newer.
- If the cloud `composer install` stage stalls on the Aliyun mirror listed in
  `backend/composer.json`, run `composer update --lock` locally to re-resolve
  against packagist.org, then commit the new `composer.lock`.
