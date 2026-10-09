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
cards, expose the bridge either by running it as another service (requires the
NAEK agent + API sink to match) or by tunneling the carwash bridge:
`cloudflared tunnel --url http://localhost:3001` and set `NEXT_PUBLIC_WS_URL` to
that URL.

### The bridge is now authenticated — this matters when it is exposed

`BRIDGE_API_KEY` gates **every** bridge endpoint, including `/camera/stream`.
That endpoint relays a live feed of the wash bay, and the ESP32-CAM in front of
it authenticates nothing at all, so the bridge is the only credential in the
path. Before this, following the tunnel instruction above put an unauthenticated
camera feed on the internet.

- The bridge compares the key with `timingSafeEqual`, header-only.
- **The browser never holds it.** A `NEXT_PUBLIC_` variable is inlined into the
  bundle and readable by anyone who opens the page, so the dashboard does not
  contact the relay directly — `/api/camera/stream` does, server-side.
- On the frontend set `CAMERA_RELAY_URL` (the tunnel base URL) and
  `CAMERA_RELAY_KEY` (the same value as the bridge's `BRIDGE_API_KEY`).
  `NEXT_PUBLIC_CAMERA_RELAY_URL` is now only a yes/no marker telling the camera
  page which message to show; it is never used to build a request.
- A `401` from the relay is reported as a key mismatch rather than an empty
  player, because that is the failure this introduces.

### Low-supply thresholds

The alert levels for water, soap and wax are **not** environment variables.
They live in the database (`system_settings`, row id=1) and are edited at
`/settings` in the dashboard, which writes them through
`PUT /api/settings` behind `role:admin,manager` with server-side bounds and an
audit-trail entry.

The bridge loads them once at start and re-reads every 60 seconds, so a change
takes effect **without a restart**. If the table has no row, or the query fails,
it falls back to 20% water / 15% soap / 15% wax and says so in its log rather
than stopping sensor logging.

A reading at or below the threshold raises an alert naming both the level and
the threshold that produced it. Recovery is automatic: when the tank comes back
above the threshold the alert is resolved, mirroring how `JAM_ERROR` already
self-heals. `createAlert` dedupes on (device, type), so a tank that stays low for
a week produces one alert rather than one per reading.

A tank that reports *nothing* is never treated as recovered — otherwise a
sensor dropping off would clear its own fault.

---

## Reaching the camera from the cloud

The ESP32-CAM is the one piece of hardware with **no authentication of its
own**. `app_httpd.cpp` registers every route as `HTTP_GET` and defines no auth
handler, so anything that can reach port 81 can watch the stream and anything
that can reach port 80 can reconfigure the sensor — including `/reg`, which
writes sensor registers directly.

The default is therefore that the camera is **not** reachable from the cloud:
`CAMERA_HOST` / `CAMERA_STREAM_URL` point at a LAN address that Vercel and
Render have no route to, and the dashboard shows the camera as offline. That
is correct behaviour, not a bug.

### If you do expose it

1. **Pin a static IP.** The stock sketch takes a DHCP lease (`WiFi.localIP()`
   is only ever printed), so `192.168.1.7` is a guess. If the lease moves, the
   proxy either 504s or — worse — talks to whatever device later claims `.7`.
   Either reserve the address in your router, or add this before
   `startCameraServer()`:

   ```cpp
   // After WiFi.begin() succeeds, before startCameraServer().
   IPAddress local(192, 168, 1, 7);
   IPAddress gateway(192, 168, 1, 1);
   IPAddress subnet(255, 255, 255, 0);
   IPAddress dns(8, 8, 8, 8);
   WiFi.config(local, gateway, subnet, dns);
   ```

   Pick an address outside your router's DHCP pool, or the lease will fight
   the static one.

2. **Set a real secret on the frontend.** `CAMERA_SESSION_SECRET` is what the
   camera proxy trusts. Without it the proxy refuses everything — fail closed,
   on purpose.

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. **Choose a transport.** A Cloudflare Tunnel from the carwash PC is the
   easiest — no router changes, and it can be revoked by deleting the tunnel.
   Port-forwarding port 81 straight through exposes the camera's own web UI
   with **no authentication at all**, which is materially worse than going
   through the app.

4. **Leave `CAMERA_PANEL_ALLOW_WRITE` off** unless you need the exposure and
   resolution controls. Watching the bay does not require them. `/reg`,
   `/greg`, `/xclk` and `/pll` are never proxied regardless of that setting.

### A limit worth knowing

Vercel terminates a function at `maxDuration`, and that cap **includes time
spent streaming a response**. On the Hobby plan 300s is both the default and
the maximum, so a continuous MJPEG feed is severed every five minutes and the
player reconnects. That is a platform limit, not a fault — `MjpegPlayer`
retries 20 times, which is about a hundred minutes of viewing before it gives
up. On Pro the cap rises to 800s.

---

## Local demo (unchanged, ₱0)

1. Start XAMPP (Apache + MySQL), `quickwash_hub` imported
2. PC WiFi -> NAEK hotspot (`Empoy Carwash Vendo`)
3. `cd iot-bridge && node index.js` (NAEK_SINK=db writes local MySQL)
4. `php artisan serve` + `npm run dev` — dashboard at localhost:3000

## Production security checklist

- [x] Frontend `qhs_session` auth gate (works cross-origin; Bearer is the real auth)
- [x] Camera proxy gated on a server-signed HttpOnly cookie, not a cookie-name
      check — the ESP32-CAM authenticates nothing, so the proxy is the boundary
- [x] Camera panel proxy is read-only by default; `/reg`, `/greg`, `/xclk` and
      `/pll` are never forwarded
- [x] Vercel preview CORS pattern scoped to your project slug, not `*.vercel.app`
- [x] No default admin credential ships — the seeder takes `ADMIN_PASSWORD` or
      generates a random one and prints it once
- [x] Node runtime pinned for the dashboard build (`frontend/.nvmrc` + `engines`)
- [x] Laravel CORS restricted to `FRONTEND_URL` (env, no wildcard in production)
- [x] NAEK ingest protected by a rotated API key
- [x] `APP_DEBUG=false`, `TRUSTED_PROXIES=*` behind the platform LB
- [ ] Replace public MQTT broker (`broker.hivemq.com`) with an authenticated
      HiveMQ Cloud / EMQX (free tier). The bridge now passes `MQTT_USERNAME` /
      `MQTT_PASSWORD` through, so setting them is all that is needed — but until
      `MQTT_BROKER` is changed, anyone can both read *and forge* `quickwash/#`
      telemetry and sale events
- [ ] Rotate the NAEK ingest key and set a fixed `APP_KEY` before going live
- [x] Camera MJPEG stays behind the Next.js `/api/camera` proxy (never the raw
      camera URL) — required on HTTPS pages
- [x] Camera proxy gated on a signed HttpOnly cookie; `/reg`, `/greg`, `/xclk`
      and `/pll` are never forwarded to the camera
- [x] Every `iot-bridge` endpoint requires `BRIDGE_API_KEY`, including the
      camera relay, and the key never reaches the browser
- [x] `MQTT_USERNAME` / `MQTT_PASSWORD` are actually passed to the MQTT connect
      — they were documented but never read, so a private broker could not be used

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
