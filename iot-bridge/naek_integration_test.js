/**
 * NAEK agent integration test (run with the mock server on :8080)
 * 1. Parser check against the REAL saved page (C:\Naek\naek_page.html)
 * 2. Baseline poll -> sale event -> DB rows
 * 3. Sales-reset event handling
 * 4. Verifies rows, then prints summary (cleanup is manual, see output)
 *
 * Usage: node naek_integration_test.js
 */
process.env.NAEK_HOST = 'http://localhost:8080';
process.env.NAEK_DEVICE_ID = 'naek_test_device';
process.env.NAEK_DEVICE_NAME = 'NAEK Test Device';
process.env.NAEK_POLL_MS = '15000';

const fs = require('fs');
const http = require('http');
const agent = require('./naek-agent');
const db = require('./db');

const DEVICE = 'naek_test_device';
const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

function post(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:8080${path}`, { method: 'POST' }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

async function rowCount(table, where, params) {
  const [rows] = await db.pool.execute(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`, params);
  return rows[0].c;
}

(async () => {
  try {
    // ---- 1. Parser vs the REAL device page ----
    const realHtml = fs.readFileSync('C:\\Naek\\naek_page.html', 'utf8');
    const snap = agent.parseNaekPage(realHtml);
    check('real page: parses', true);
    check('real page: 3 products', snap.products.length === 3, snap.products.map((p) => p.name).join(','));
    check('real page: WASH usage=12', snap.products[0].name === 'WASH' && snap.products[0].usage === 12);
    check('real page: DRY usage=8 net=80', snap.products[1].usage === 8 && snap.products[1].net === 80);
    check('real page: FOAM usage=4', snap.products[2].usage === 4);
    check('real page: totalSales=240', snap.totalSales === 240);
    check('real page: all OFF', snap.products.every((p) => p.status === 'OFF'));
    check('real page: shop name', snap.shopName === 'Empoy CarWash', snap.shopName);

    // ---- 2. Baseline poll (device online + snapshot stored) ----
    await agent.poll();
    check('baseline: device registered online', (await rowCount('devices', 'id = ? AND status = ?', [DEVICE, 'online'])) === 1);
    check('baseline: no transactions yet', (await rowCount('vending_transactions', 'device_id = ?', [DEVICE])) === 0);

    // ---- 3. A sale happens on the device ----
    await post('/mock/sale?product=0'); // WASH usage 12 -> 13
    await agent.poll();
    check('sale: transaction logged', (await rowCount('vending_transactions', 'device_id = ?', [DEVICE])) === 1);
    const [txn] = await db.pool.execute('SELECT amount, payment_method FROM vending_transactions WHERE device_id = ? ORDER BY id DESC LIMIT 1', [DEVICE]);
    check('sale: amount = ₱10 coin', Number(txn[0].amount) === 10 && txn[0].payment_method === 'coin');
    check('sale: wash_log logged', (await rowCount('wash_logs', 'device_id = ?', [DEVICE])) === 1);
    const [wl] = await db.pool.execute('SELECT cycle_type, price, duration_seconds FROM wash_logs WHERE device_id = ? ORDER BY id DESC LIMIT 1', [DEVICE]);
    check('sale: wash_log details', wl[0].cycle_type === 'wash' && Number(wl[0].price) === 10 && wl[0].duration_seconds === 30);
    check('sale: audit logged', (await rowCount('audit_logs', "action = 'NAEK_SALE' AND details LIKE ?", ['%NAEK Test Device%'])) >= 1);

    // ---- 4. No-change poll must NOT duplicate ----
    await agent.poll();
    check('dedupe: second poll adds nothing', (await rowCount('vending_transactions', 'device_id = ?', [DEVICE])) === 1);

    // ---- 5. Sales reset on the device ----
    await post('/mock/reset');
    await agent.poll();
    check('reset: no negative/duplicate txn', (await rowCount('vending_transactions', 'device_id = ?', [DEVICE])) === 1);
    check('reset: audit logged', (await rowCount('audit_logs', "action = 'NAEK_SALES_RESET' AND details LIKE ?", ['%NAEK Test Device%'])) >= 1);

    // ---- 6. Snapshot after reset parses to zero usage ----
    await agent.poll(); // baseline resync on zeros
    const after = await new Promise((resolve, reject) => {
      http.get('http://localhost:8080/', (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(agent.parseNaekPage(b)));
      }).on('error', reject);
    });
    check('reset: usages are 0', after.products.every((p) => p.usage === 0) && after.totalSales === 0);

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n===== ${passed}/${results.length} checks passed =====`);
    console.log('Cleanup when done:');
    console.log(`  DELETE FROM vending_transactions WHERE device_id='${DEVICE}';`);
    console.log(`  DELETE FROM wash_logs WHERE device_id='${DEVICE}';`);
    console.log(`  DELETE FROM devices WHERE id='${DEVICE}';`);
    console.log(`  DELETE FROM audit_logs WHERE details LIKE '%NAEK Test Device%';`);
    process.exit(passed === results.length ? 0 : 1);
  } catch (e) {
    console.error('TEST CRASH:', e);
    process.exit(1);
  } finally {
    agent.stop();
    await db.pool.end();
  }
})();
