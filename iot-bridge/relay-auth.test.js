const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');

const ROOT = 'C:/xampp/htdocs/xampp/Capstone Project/QuickWash-Smart-Hub/';
const bridge = readFileSync(ROOT + 'iot-bridge/index.js', 'utf8');
const page = readFileSync(ROOT + 'frontend/src/app/cameras/page.tsx', 'utf8');
const stream = readFileSync(ROOT + 'frontend/src/app/api/camera/stream/route.ts', 'utf8');

// /camera/stream had no authentication at all, and DEPLOY.md tells operators to
// expose this agent with `cloudflared tunnel --url http://localhost:3001`.
// Following that instruction put a live feed of the wash bay on the internet
// with no credential, in front of an ESP32-CAM that authenticates nothing.
test('the camera relay endpoints require the api key', () => {
  assert.match(bridge, /app\.get\('\/camera\/stream', requireApiKey/, '/camera/stream must be gated');
  assert.match(bridge, /app\.get\('\/camera\/status', requireApiKey/, '/camera/status must be gated');
});

test('no camera endpoint is left open', () => {
  const open = [...bridge.matchAll(/app\.(get|post|put|delete)\('([^']+)',\s*async/g)].map((m) => m[2]);
  const gated = [...bridge.matchAll(/app\.(get|post|put|delete)\('([^']+)',\s*requireApiKey/g)].map((m) => m[2]);
  assert.deepEqual(open, [], 'every route must carry a guard');
  // /health is deliberately open: it reports connectivity, not data.
  assert.ok(gated.includes('/camera/stream'));
  assert.ok(gated.includes('/camera/status'));
});

test('the key comparison is constant-time', () => {
  // A byte-at-a-time oracle on a shared secret is a real leak on a
  // network-reachable endpoint.
  assert.match(bridge, /timingSafeEqual/);
  assert.doesNotMatch(
    bridge,
    /if \(!API_KEY \|\| key !== API_KEY\)/,
    'the plain !== comparison is what this replaces',
  );
});

test('the browser never contacts the relay directly', () => {
  // NEXT_PUBLIC_ values are inlined into the bundle, so any key the browser sent
  // to the bridge would be readable by anyone who opens the page.
  assert.doesNotMatch(
    page,
    /STREAM_URL\s*=\s*CAMERA_RELAY_URL/,
    'the stream URL must not be built from a NEXT_PUBLIC_ variable',
  );
  assert.match(page, /const STREAM_URL = '\/api\/camera\/stream';/);
});

test('the relay credential is sent server-side only', () => {
  assert.match(stream, /process\.env\.CAMERA_RELAY_KEY/);
  assert.match(stream, /'x-api-key': CAMERA_RELAY_KEY/);
  assert.doesNotMatch(stream, /NEXT_PUBLIC_CAMERA_RELAY_KEY/);

  // The key must not appear in a client module. The cameras page mentions the
  // name in user-facing help text (telling an operator which variable to set),
  // which is not the same as holding a value - what matters is that it never
  // reads process.env for it.
  assert.doesNotMatch(page, /process\.env\.CAMERA_RELAY_KEY/);
});

test('a relay 401 is reported as a key mismatch, not an empty player', () => {
  assert.match(stream, /upstream\.status === 401/);
  assert.match(stream, /CAMERA_RELAY_KEY.*BRIDGE_API_KEY/s);
});

test('MQTT credentials are actually passed to the connection', () => {
  // .env.example documented MQTT_USERNAME / MQTT_PASSWORD and told operators to
  // use them for a private broker, but nothing read them.
  assert.match(bridge, /const MQTT_USERNAME = process\.env\.MQTT_USERNAME/);
  assert.match(bridge, /const MQTT_PASSWORD = process\.env\.MQTT_PASSWORD/);
  assert.match(bridge, /username: MQTT_USERNAME, password: MQTT_PASSWORD/);
  assert.match(bridge, /\.\.\.mqttAuth/, 'the credentials must reach mqtt.connect');
});

test('an unauthenticated broker still works for a bench demo', () => {
  // broker.hivemq.com takes no credentials, so requiring them would break the
  // demo path.
  assert.match(bridge, /MQTT_USERNAME && MQTT_PASSWORD/, 'credentials must be optional');
});

test('the route guard follows the Next 16 proxy convention', () => {
  // Next 16 renamed the middleware file convention to proxy, and the exported
  // function has to match the file name or the guard silently stops running.
  const proxy = readFileSync(ROOT + 'frontend/src/proxy.ts', 'utf8');
  assert.match(proxy, /export function proxy\(/, 'the export must be named proxy');

  // And nothing may still be pointing at the old path.
  const api = readFileSync(ROOT + 'backend/app/Http/Controllers/Api/AuthController.php', 'utf8');
  assert.doesNotMatch(api, /src\/middleware\.ts/, 'a comment still points at the old path');
});
