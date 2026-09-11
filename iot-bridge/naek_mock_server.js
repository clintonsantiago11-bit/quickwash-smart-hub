/**
 * Mock NAEK 3-in-1 server for offline integration testing.
 * Mimics the stock firmware: serves the dashboard page (with the admin
 * settings form), applies POST /save (multipart like the browser FormData),
 * and exposes /mock/* hooks to simulate sales/reset/status.
 *
 * Usage: node naek_mock_server.js [port]
 */
const http = require('http');

const PORT = parseInt(process.argv[2] || '8080', 10);
const DEFAULTS = {
  shopName: 'Empoy CarWash',
  apSSID: 'Empoy Carwash Vendo',
  apPass: '123456789',
  lcdSleep: '60',
  credits: 0,
  products: [
    { name: 'WASH', rate: 10, duration: 30, pause: true, status: 'OFF', usage: 12 },
    { name: 'DRY', rate: 10, duration: 30, pause: true, status: 'OFF', usage: 8 },
    { name: 'FOAM', rate: 10, duration: 30, pause: true, status: 'OFF', usage: 4 }
  ]
};
const state = JSON.parse(JSON.stringify(DEFAULTS));

const N = (p, n) => `<input name='${p}${n}' value='${state.products[n].name}'>`
    + `<input name='pcred${n}' value='${state.products[n].rate}'>`
    + `<input name='psec${n}' value='${state.products[n].duration}'>`
    + `<input type='checkbox' name='ppauseEn${n}'${state.products[n].pause ? ' checked' : ''}>`;

function buildPage() {
  const rows = state.products
    .map((p, n) => `<tr><td>${p.name}</td><td>${p.rate}</td><td>${p.duration}</td><td><span style='color:${p.status === 'ON' ? 'green' : 'red'}'>${p.status}</span></td><td>${p.usage}</td><td><b>${p.rate * p.usage}</b></td></tr>`)
    .join('');
  const total = state.products.reduce((s, p) => s + p.rate * p.usage, 0);
  const fieldsets = state.products
    .map((p, n) => `<fieldset><legend>Product ${n + 1}</legend><div><label>Name:</label>${N('pname', n)}</div><div><label>Rate (₱):</label></div><div><label>Duration (s):</label></div><div><label>Enable Pause3x:</label></div><div><label>Usage:</label><span>${p.usage}</span></div></fieldset>`)
    .join('');
  return Buffer.from(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>NAEK 3-in-1 SMART CARWASH</title></head>
<body>
<h2>NAEK 3-in-1 SMART CARWASH</h2>
<div class="container">
<p><b>Wi-Fi NAME:</b> ${state.apSSID}</p>
<p><b>Credits:</b> ${state.credits}</p>
<table>
<tr><th>Product</th><th>Rate (₱)</th><th>Duration (s)</th><th>Status</th><th>Usage</th><th>Net</th></tr>
${rows}
<tr><th colspan='5' style='text-align:right'>TOTAL SALES:</th><th>${total}</th></tr>
</table>
<form id="settingsForm">
<fieldset>
<div><label>Shop name:</label><input name="shopName" value="${state.shopName}"></div>
<div><label>WiFi name:</label><input name="apSSID" value="${state.apSSID}"></div>
<div><label>WiFi password:</label><input type="password" name="apPass" value="${state.apPass}"></div>
<label>LCD sleep(m):</label><input name="lcdSleep" value="${state.lcdSleep}"></div>
${fieldsets}
</fieldset>
</form>
</div>
</body>
</html>`);
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
function parseForm(buf, contentType) {
  const out = {};
  if (!contentType) return out;
  const m = contentType.match(/boundary=(.+)$/);
  if (m) {
    const boundary = '--' + m[1].trim();
    buf.toString('latin1').split(boundary).forEach((part) => {
      const head = part.split('\r\n\r\n');
      if (head.length < 2) return;
      const nameMatch = head[0].match(/name="([^"]+)"/);
      if (!nameMatch) return;
      out[nameMatch[1]] = head.slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    });
  } else {
    new URLSearchParams(buf.toString('utf8')).forEach((v, k) => { out[k] = v; });
  }
  return out;
}
function applySave(f) {
  if (f.shopName !== undefined) state.shopName = f.shopName;
  if (f.apSSID !== undefined) state.apSSID = f.apSSID;
  if (f.apPass !== undefined) state.apPass = f.apPass;
  if (f.lcdSleep !== undefined) state.lcdSleep = f.lcdSleep;
  for (let n = 0; n < state.products.length; n++) {
    if (f['pname' + n] !== undefined) state.products[n].name = f['pname' + n];
    if (f['pcred' + n] !== undefined) state.products[n].rate = parseInt(f['pcred' + n], 10) || 0;
    if (f['psec' + n] !== undefined) state.products[n].duration = parseInt(f['psec' + n], 10) || 0;
    state.products[n].pause = ('ppauseEn' + n) in f;
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/save' && req.method === 'POST') {
    const buf = await readBody(req);
    const form = parseForm(buf, req.headers['content-type'] || '');
    applySave(form);
    console.log('[MOCK] /save applied:', JSON.stringify(form));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ reboot: false }));
  }
  if (url.pathname === '/mock/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }
  if (url.pathname === '/mock/sale' && req.method === 'POST') {
    const idx = parseInt(url.searchParams.get('product') || '0', 10);
    const count = parseInt(url.searchParams.get('count') || '1', 10);
    const p = state.products[idx];
    if (p) { p.status = 'ON'; p.usage += count; console.log('[MOCK] sale on', p.name, 'usage=', p.usage); setTimeout(() => { p.status = 'OFF'; }, 2000); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === '/mock/reset' && req.method === 'POST') {
    // Mirrors the real device's /reset_sales: zeroes the counters only.
    state.products.forEach((p) => (p.usage = 0));
    state.total_sales = 0;
    console.log('[MOCK] sales reset (usage zeroed)');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === '/mock/status' && req.method === 'POST') {
    const idx = parseInt(url.searchParams.get('product') || '0', 10);
    const v = url.searchParams.get('v') === 'ON' ? 'ON' : 'OFF';
    if (state.products[idx]) state.products[idx].status = v;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  await readBody(req);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildPage());
});
server.listen(PORT, () => {
  console.log(`[MOCK] NAEK mock on http://localhost:${PORT}`);
});