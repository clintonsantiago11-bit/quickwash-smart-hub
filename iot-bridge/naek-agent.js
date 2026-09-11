/**
 * QuickWash Smart Hub - NAEK Edge Agent (2-way config sync)
 *
 * Polls the stock NAEK 3-in-1 carwash timer web page (LAN-only device,
 * default http://192.168.4.1 while its hotspot is joined) and syncs BOTH
 * directions with QuickWash:
 *
 *   READ  GET /   -> parse product table (status/usage/net/sales)
 *   WRITE POST /save -> apply dashboard edits to the device (same as pressing
 *                       SAVE SETTINGS; NEVER touches apSSID/apPass or reboot)
 *
 * Two-way reconcile (poll loop, default 5s):
 *   1. Read device page -> snapshot
 *   2. Write observed values back to the DB mirror (naek_config/naek_products)
 *   3. If sync_pending is set (dashboard edit), POST /save with desired values,
 *      clear the flag once the device acks and reports them back.
 *
 * Reconciliation rule: live fields (usage/net/status/sales) ALWAYS come from
 * the device. Editable fields (name/rate/duration/shop/lcd) come from the
 * device UNLESS a dashboard edit is pending, in which case the desired value
 * wins until the push succeeds.
 *
 * Sink adapter (NAEK_SINK env): 'db' (local) | 'api' (cloud ingest).
 * Socket.IO events: naek_update (snapshot+events), naek_config (config mirror).
 * All config via env vars - no hardcoded hosts.
 */

require('dotenv').config();

const db = require('./db');

const NAEK_HOST = (process.env.NAEK_HOST || 'http://192.168.4.1').replace(/\/+$/, '');
const NAEK_DEVICE_ID = process.env.NAEK_DEVICE_ID || 'naek_carwash_1';
const NAEK_DEVICE_NAME = process.env.NAEK_DEVICE_NAME || 'NAEK 3-in-1 Carwash Timer';
const NAEK_POLL_MS = Math.max(5000, parseInt(process.env.NAEK_POLL_MS || '5000', 10));
const NAEK_SINK = (process.env.NAEK_SINK || 'db').toLowerCase();
const NAEK_API_URL = (process.env.NAEK_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
const NAEK_API_KEY = process.env.NAEK_API_KEY || 'quickwash-bridge-key';
const FETCH_TIMEOUT_MS = 8000;

let io = null;
let pollTimer = null;
let running = false;
let prev = null;
let consecutiveFailures = 0;
let lastOfflineAudit = 0;
let applyingPending = false;

function parseNaekPage(html) {
  if (!html || !html.includes('NAEK')) throw new Error('Response does not look like a NAEK page');

  const creditsMatch = html.match(/<b>Credits:<\/b>\s*(\d+)/);
  const shopMatch = html.match(/name="shopName" value="([^"]*)"/);
  const totalMatch = html.match(/TOTAL SALES:<\/th><th>(\d+)<\/th>/);
  const lcdMatch = html.match(/name="lcdSleep" value="(\d+)"/);

  const rowRe = /<tr><td>([^<]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td><td><span[^>]*>(ON|OFF)<\/span><\/td><td>(\d+)<\/td><td><b>(\d+)<\/b><\/td><\/tr>/g;
  const pauseRe = /name='ppauseEn(\d)'([^>]*)>/g;
  const products = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    products.push({ name: m[1].trim(), rate: parseInt(m[2], 10), duration: parseInt(m[3], 10), status: m[4], usage: parseInt(m[5], 10), net: parseInt(m[6], 10) });
  }
  const pause = {};
  while ((m = pauseRe.exec(html)) !== null) pause[m[1]] = m[2].includes('checked');
  products.forEach((p, i) => { p.pause = pause[String(i)] ?? true; });
  if (products.length === 0) throw new Error('No product rows found in NAEK page');

  return {
    shopName: shopMatch ? shopMatch[1] : '',
    lcdSleep: lcdMatch ? parseInt(lcdMatch[1], 10) : 60,
    credits: creditsMatch ? parseInt(creditsMatch[1], 10) : 0,
    totalSales: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    products
  };
}

function fetchNaekPage() {
  return fetch(`${NAEK_HOST}/`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status} from ${NAEK_HOST}`); return res.text(); });
}

function diffSnapshots(curr, prevSnap) {
  const events = [];
  const before = new Map(prevSnap.products.map((p) => [p.name, p]));
  for (const p of curr.products) {
    const was = before.get(p.name);
    if (!was) continue;
    const delta = p.usage - was.usage;
    if (delta > 0) events.push({ type: 'sale', product: p.name, count: delta, amount: p.rate * delta, durationSeconds: p.duration });
    else if (delta < 0) events.push({ type: 'sales_reset', product: p.name });
  }
  if (curr.totalSales < prevSnap.totalSales) events.push({ type: 'total_reset', from: prevSnap.totalSales, to: curr.totalSales });
  return events;
}

async function persistEventDb(ev) {
  try {
    if (ev.type === 'sale') {
      const now = new Date();
      const startedAt = new Date(now.getTime() - ev.durationSeconds * ev.count * 1000);
      await db.pool.execute(`INSERT INTO vending_transactions (device_id, amount, payment_method, transaction_time) VALUES (?, ?, 'coin', NOW())`, [NAEK_DEVICE_ID, ev.amount]);
      await db.pool.execute(`INSERT INTO wash_logs (device_id, cycle_type, price, started_at, completed_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)`, [NAEK_DEVICE_ID, ev.product.toLowerCase(), ev.amount, startedAt, now, ev.durationSeconds * ev.count]);
      const label = ev.count > 1 ? `${ev.count}x ${ev.product}` : ev.product;
      await db.createAuditLog('System', 'NAEK_SALE', `${label} cycle sold on the ${NAEK_DEVICE_NAME} — ₱${ev.amount}`);
    } else if (ev.type === 'sales_reset' || ev.type === 'total_reset') {
      await db.createAuditLog('System', 'NAEK_SALES_RESET', `Sales counters were reset on the ${NAEK_DEVICE_NAME}`);
    }
  } catch (error) {
    console.error(`[NAEK] DB write failed for ${ev.type}:`, error.message);
  }
}async function writeSnapshotDb(snapshot) {
  try {
    // Live fields (credits/total_sales/last_seen) always follow the device.
    // Editable fields (shop_name/lcd_sleep_min) only follow the device when
    // no dashboard edit is pending (sync_pending=0).
    await db.pool.execute(
      `INSERT INTO naek_config (device_id, shop_name, lcd_sleep_min, credits, total_sales, last_seen_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         credits=VALUES(credits), total_sales=VALUES(total_sales), last_seen_at=NOW(), updated_at=NOW(),
         shop_name=IF(sync_pending=1, shop_name, VALUES(shop_name)),
         lcd_sleep_min=IF(sync_pending=1, lcd_sleep_min, VALUES(lcd_sleep_min))`,
      [NAEK_DEVICE_ID, snapshot.shopName, snapshot.lcdSleep, snapshot.credits, snapshot.totalSales]
    );
    for (let slot = 0; slot < snapshot.products.length; slot++) {
      const p = snapshot.products[slot];
      await db.pool.execute(
        `INSERT INTO naek_products (device_id, slot, name, rate, duration_seconds, pause_enabled, \`usage\`, \`net\`, \`status\`, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           \`usage\`=VALUES(\`usage\`), \`net\`=VALUES(\`net\`), \`status\`=VALUES(\`status\`), updated_at=NOW(),
           name=IF(sync_pending=1, name, VALUES(name)),
           rate=IF(sync_pending=1, rate, VALUES(rate)),
           duration_seconds=IF(sync_pending=1, duration_seconds, VALUES(duration_seconds)),
           pause_enabled=IF(sync_pending=1, pause_enabled, VALUES(pause_enabled))`,
        [NAEK_DEVICE_ID, slot, p.name, p.rate, p.duration, p.pause ? 1 : 0, p.usage, p.net, p.status]
      );
    }
  } catch (error) {
    console.error('[NAEK] snapshot DB write failed:', error.message);
  }
}

async function hasPendingDb() {
  try {
    const [cfg] = await db.pool.execute('SELECT sync_pending FROM naek_config WHERE device_id = ?', [NAEK_DEVICE_ID]);
    if (cfg.length && cfg[0].sync_pending) return true;
    const [prod] = await db.pool.execute('SELECT 1 FROM naek_products WHERE device_id = ? AND sync_pending = 1 LIMIT 1', [NAEK_DEVICE_ID]);
    return prod.length > 0;
  } catch { return false; }
}

async function readDesiredDb() {
  const [cfg] = await db.pool.execute('SELECT shop_name, lcd_sleep_min FROM naek_config WHERE device_id = ?', [NAEK_DEVICE_ID]);
  const [prods] = await db.pool.execute('SELECT slot, name, rate, duration_seconds, pause_enabled FROM naek_products WHERE device_id = ? ORDER BY slot', [NAEK_DEVICE_ID]);
  return { config: cfg[0] || { shop_name: '', lcd_sleep_min: 60 }, products: prods };
}

async function writeProductValuesToDevice() {
  const desired = await readDesiredDb();
  const form = new FormData();
  form.append('shopName', desired.config.shop_name || '');
  form.append('lcdSleep', String(desired.config.lcd_sleep_min ?? 60));
  for (const p of desired.products) {
    form.append(`pname${p.slot}`, p.name);
    form.append(`pcred${p.slot}`, String(p.rate));
    form.append(`psec${p.slot}`, String(p.duration_seconds));
    if (p.pause_enabled) form.append(`ppauseEn${p.slot}`, 'on');
  }
  // Never send apSSID/apPass (saving them can reboot/renet the device).
  const res = await fetch(`${NAEK_HOST}/save`, { method: 'POST', body: form, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`/save HTTP ${res.status}`);
}

async function clearPendingDb() {
  try {
    await db.pool.execute('UPDATE naek_config SET sync_pending = 0 WHERE device_id = ?', [NAEK_DEVICE_ID]);
    await db.pool.execute('UPDATE naek_products SET sync_pending = 0 WHERE device_id = ?', [NAEK_DEVICE_ID]);
  } catch (e) {
    console.error('[NAEK] clear pending failed:', e.message);
  }
}

async function pushSnapshotApi(snapshot, events) {
  try {
    const res = await fetch(`${NAEK_API_URL}/ingest/naek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': NAEK_API_KEY },
      body: JSON.stringify({ deviceId: NAEK_DEVICE_ID, deviceName: NAEK_DEVICE_NAME, snapshot, events }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`ingest HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[NAEK] Cloud ingest failed:', error.message);
    return null;
  }
}

async function markDeviceOnline() {
  if (NAEK_SINK !== 'db') return;
  try {
    await db.ensureDevice(NAEK_DEVICE_ID, 'vending');
    await db.pool.execute('UPDATE devices SET name = ? WHERE id = ?', [NAEK_DEVICE_NAME, NAEK_DEVICE_ID]);
  } catch (error) {
    console.error('[NAEK] Heartbeat failed:', error.message);
  }
}

async function markDeviceOffline(reason) {
  consecutiveFailures += 1;
  if (NAEK_SINK !== 'db') return;
  try {
    const [result] = await db.pool.execute("UPDATE devices SET status = 'offline' WHERE id = ? AND status = 'online'", [NAEK_DEVICE_ID]);
    const now = Date.now();
    if (result.affectedRows > 0 && now - lastOfflineAudit > 60000) {
      lastOfflineAudit = now;
      await db.createAuditLog('System', 'DEVICE_OFFLINE', `The ${NAEK_DEVICE_NAME} went offline (${reason})`);
    }
  } catch (error) {
    console.error('[NAEK] Offline marking failed:', error.message);
  }
}function emitConfig(snapshot) {
  if (io) {
    io.emit('naek_config', {
      deviceId: NAEK_DEVICE_ID,
      shopName: snapshot.shopName,
      lcdSleep: snapshot.lcdSleep,
      products: snapshot.products,
      credits: snapshot.credits,
      totalSales: snapshot.totalSales,
      timestamp: new Date().toISOString()
    });
  }
}

async function poll() {
  let html;
  try {
    html = await fetchNaekPage();
  } catch (error) {
    await markDeviceOffline(error.message);
    return;
  }

  let snapshot;
  try {
    snapshot = parseNaekPage(html);
  } catch (error) {
    console.error(`[NAEK] Parse failed: ${error.message}`);
    return;
  }

  if (consecutiveFailures > 0) console.log('[NAEK] Device back online');
  consecutiveFailures = 0;
  await markDeviceOnline();

  // 1) Persist observed state + detect sale/reset events
  const events = prev ? diffSnapshots(snapshot, prev) : [];
  if (NAEK_SINK === 'db') {
    await writeSnapshotDb(snapshot);
    for (const ev of events) await persistEventDb(ev);
  } else {
    await pushSnapshotApi(snapshot, events);
  }

  prev = snapshot;

  // 2) Reconcile pending dashboard edits (db mode): desired state -> device
  if (NAEK_SINK === 'db' && !applyingPending && (await hasPendingDb())) {
    applyingPending = true;
    try {
      console.log('[NAEK] Applying pending dashboard config to device...');
      await writeProductValuesToDevice();
      await clearPendingDb();
      snapshot = await (async () => { try { return parseNaekPage(await fetchNaekPage()); } catch { return snapshot; } })();
      await writeSnapshotDb(snapshot);
    } catch (error) {
      console.error('[NAEK] Failed to apply config to device:', error.message);
      await db.createAuditLog('System', 'NAEK_SYNC_ERROR', `Failed to push dashboard config to the ${NAEK_DEVICE_NAME}: ${error.message}`);
    } finally { applyingPending = false; }
  }

  // 3) Emit live updates to browsers
  if (io) {
    io.emit('naek_update', { deviceId: NAEK_DEVICE_ID, snapshot, events, timestamp: new Date().toISOString() });
    emitConfig(snapshot);
  }
}

function start(ioServer) {
  if (running) return;
  running = true;
  io = ioServer || null;
  console.log(`🧼 NAEK agent starting — host=${NAEK_HOST} device=${NAEK_DEVICE_ID} sink=${NAEK_SINK} every=${NAEK_POLL_MS}ms`);
  poll();
  pollTimer = setInterval(poll, NAEK_POLL_MS);
}

function stop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  running = false;
}

module.exports = { start, stop, poll, parseNaekPage, diffSnapshots };