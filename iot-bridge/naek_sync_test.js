/**
 * NAEK 2-way sync integration test.
 * Requires the mock NAEK server on :8080 (start it first).
 * Uses a real MySQL DB (writes to naek_* + devices rows for naek_sync_test).
 *
 * Covers:
 *  1. Baseline poll -> observed state written to naek_config/naek_products
 *  2. Dashboard edit (sync_pending=1) -> agent POSTs /save -> device updated,
 *     pending cleared, re-read confirms
 *  3. Device-side edit -> agent poll -> DB mirror updated
 *  4. Socket.IO broadcast (fake io recorder receives naek_config + naek_update)
 *
 * Run: node naek_sync_test.js
 */
process.env.NAEK_HOST = 'http://localhost:8080';
process.env.NAEK_DEVICE_ID = 'naek_sync_test';
process.env.NAEK_DEVICE_NAME = 'NAEK Sync Test';
process.env.NAEK_POLL_MS = '5000';

const agent = require('./naek-agent');
const db = require('./db');
const DEVICE = 'naek_sync_test';
const emitted = [];
const fakeIo = { emit: (event, payload) => emitted.push({ event, payload }) };

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function q(sql, params) {
  const [rows] = await db.pool.execute(sql, params);
  return rows;
}

async function mockConfig() {
  const r = await fetch('http://localhost:8080/mock/config');
  return r.json();
}

async function mockSave(form) {
  const r = await fetch('http://localhost:8080/save', { method: 'POST', body: form });
  return r.json();
}

(async () => {
  try {
    await db.pool.execute('DELETE FROM naek_config WHERE device_id=?', [DEVICE]);
    await db.pool.execute('DELETE FROM naek_products WHERE device_id=?', [DEVICE]);
    await db.pool.execute('DELETE FROM devices WHERE id=?', [DEVICE]);
    await db.pool.execute("DELETE FROM audit_logs WHERE details LIKE '%NAEK Sync Test%'");

    // --- 1. Baseline ---
    agent.start(fakeIo);
    await post('/mock/reset');
    await post('/mock/sale?product=0'); await agent.poll(); // establish baseline with a clean sale
    await agent.poll();
    const cfg = await q('SELECT shop_name, lcd_sleep_min FROM naek_config WHERE device_id=?', [DEVICE]);
    const prods = await q('SELECT slot, name, rate, duration_seconds FROM naek_products WHERE device_id=? ORDER BY slot', [DEVICE]);
    check('baseline: config row exists', cfg.length === 1, cfg[0] && cfg[0].shop_name);
    check('baseline: 3 product rows', prods.length === 3);
    check('baseline: WASH rate=10 dur=30', prods[0].rate === 10 && prods[0].duration_seconds === 30);
    check('baseline: device online', (await q('SELECT status FROM devices WHERE id=?', [DEVICE]))[0].status === 'online');

    // --- 2. Dashboard edit -> pending -> agent pushes to device ---
    await db.pool.execute('UPDATE naek_config SET sync_pending=1, shop_name=? WHERE device_id=?', ['Sync Shop', DEVICE]);
    await db.pool.execute('UPDATE naek_products SET sync_pending=1, rate=25, duration_seconds=45 WHERE device_id=? AND slot=0', [DEVICE]);
    await agent.poll();
    const dev1 = await mockConfig();
    check('dashboard->device: shop name applied', dev1.shopName === 'Sync Shop', dev1.shopName);
    check('dashboard->device: product rate applied', dev1.products[0].rate === 25, String(dev1.products[0].rate));
    check('dashboard->device: product duration applied', dev1.products[0].duration === 45);
    check('dashboard->device: pending cleared', (await q('SELECT sync_pending FROM naek_config WHERE device_id=?', [DEVICE]))[0].sync_pending === 0);
    check('dashboard->device: product pending cleared', (await q('SELECT sync_pending FROM naek_products WHERE device_id=? AND slot=0', [DEVICE]))[0].sync_pending === 0);
    check('dashboard->device: re-read matches', (await q('SELECT name FROM naek_products WHERE device_id=? AND slot=0', [DEVICE]))[0].name === 'WASH');

    // --- 3. Device-side edit -> agent mirror update ---
    const f = new FormData();
    f.append('shopName', 'Device Edited');
    f.append('pname0', 'RINSE');
    await mockSave(f);
    await agent.poll();
    const cfg2 = await q('SELECT shop_name FROM naek_config WHERE device_id=?', [DEVICE]);
    const prod2 = await q('SELECT name FROM naek_products WHERE device_id=? AND slot=0', [DEVICE]);
    check('device->dashboard: shop name synced', cfg2[0].shop_name === 'Device Edited', cfg2[0].shop_name);
    check('device->dashboard: product renamed', prod2[0].name === 'RINSE', prod2[0].name);

    // --- 4. Socket broadcast ---
    check('socket: naek_config emitted', emitted.some((e) => e.event === 'naek_config'));
    check('socket: naek_update emitted', emitted.some((e) => e.event === 'naek_update'));
    const lastCfg = emitted.filter((e) => e.event === 'naek_config').pop();
    check('socket: config carries products', lastCfg && lastCfg.payload.products && lastCfg.payload.products.length === 3);

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n===== ${passed}/${results.length} sync checks passed =====`);
    console.log('Cleanup:');
    console.log(`  DELETE FROM naek_config WHERE device_id='${DEVICE}';`);
    console.log(`  DELETE FROM naek_products WHERE device_id='${DEVICE}';`);
    console.log(`  DELETE FROM devices WHERE id='${DEVICE}';`);
    console.log(`  DELETE FROM audit_logs WHERE details LIKE '%NAEK Sync Test%';`);
    process.exit(passed === results.length ? 0 : 1);
  } catch (e) {
    console.error('TEST CRASH:', e);
    process.exit(1);
  } finally {
    agent.stop();
    await db.pool.end();
  }
})();
