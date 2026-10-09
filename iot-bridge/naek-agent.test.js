const assert = require('node:assert/strict');
const { test } = require('node:test');

const { diffSnapshots, parseNaekPage } = require('./naek-agent.js');

/**
 * This decides whether a coin drop is booked as revenue. It had no tests, and
 * matching products by NAME turned out to be wrong in both directions:
 *
 *  - renaming a product and selling one in the same poll produced no events at
 *    all, so the coins were taken and nothing was recorded;
 *  - two products sharing a name produced a phantom sale, because the name-keyed
 *    map kept the first and the second looked like it had jumped by its entire
 *    usage count.
 */

const P = (slot, name, usage, rate = 50, duration = 600) => ({
  slot,
  name,
  usage,
  rate,
  duration,
  status: 'ON',
  net: 0,
});

const snap = (products, totalSales = 100) => ({ totalSales, products });

test('an ordinary sale is booked with the right amount and count', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 11), P(1, 'DRY', 5)]),
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5)])
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'sale');
  assert.equal(events[0].count, 1);
  assert.equal(events[0].amount, 50);
  assert.equal(events[0].product, 'WASH');
});

test('several units in one poll are booked as a count, not separate events', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 13)]),
    snap([P(0, 'WASH', 10)])
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].count, 3);
  assert.equal(events[0].amount, 150);
});

test('renaming a product does not lose the sale', () => {
  // This is the case name-matching silently dropped. The operator renames WASH
  // to PREMIUM and someone buys one in the same poll: the coins are taken and
  // nothing is recorded, so the revenue silently under-reports.
  const events = diffSnapshots(
    snap([P(0, 'PREMIUM', 11)]),
    snap([P(0, 'WASH', 10)])
  );

  assert.equal(events.length, 1, 'a rename must not swallow a real sale');
  assert.equal(events[0].type, 'sale');
  assert.equal(events[0].count, 1);
  assert.equal(events[0].product, 'PREMIUM', 'reported under the new name');
});

test('two products sharing a name do not invent a sale', () => {
  // Name-matching kept the first WASH in its map, so the second looked like it
  // had jumped by its entire usage count and booked a phantom sale.
  const events = diffSnapshots(
    snap([P(0, 'WASH', 10), P(1, 'WASH', 10)]),
    snap([P(0, 'WASH', 10), P(1, 'WASH', 10)])
  );

  assert.deepEqual(events, [], 'identical readings must produce no events');
});

test('duplicate names with a genuine sale only book the real delta', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 10), P(1, 'WASH', 11)]),
    snap([P(0, 'WASH', 10), P(1, 'WASH', 10)])
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].count, 1, 'one unit, not the second product’s whole history');
});

test('swapping two products between slots does not fabricate revenue', () => {
  // Name-matching saw WASH disappear and DRY jump from 5 to 10, booking a
  // 5-unit sale that never happened.
  const events = diffSnapshots(
    snap([P(0, 'DRY', 10), P(1, 'WASH', 5)]),
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5)])
  );

  assert.deepEqual(events, [], 'a rename swap is not a sale');
});

test('a counter reset is reported rather than booked as a sale', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 0)]),
    snap([P(0, 'WASH', 10)])
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'sales_reset');
});

test('a total-sales reset is reported', () => {
  const events = diffSnapshots(snap([P(0, 'WASH', 10)], 0), snap([P(0, 'WASH', 10)], 100));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'total_reset');
  assert.equal(events[0].from, 100);
  assert.equal(events[0].to, 0);
});

test('a product the previous poll never reported produces no event', () => {
  // No baseline means no delta can be computed. Guessing would fabricate one.
  const events = diffSnapshots(
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5), P(2, 'RINSE', 3)]),
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5)])
  );

  assert.deepEqual(events, []);
});

test('unchanged readings produce nothing', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5)]),
    snap([P(0, 'WASH', 10), P(1, 'DRY', 5)])
  );

  assert.deepEqual(events, []);
});

test('a sale and a reset in the same poll are both reported', () => {
  const events = diffSnapshots(
    snap([P(0, 'WASH', 12), P(1, 'DRY', 0)]),
    snap([P(0, 'WASH', 10), P(1, 'DRY', 8)])
  );

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'sale');
  assert.equal(events[1].type, 'sales_reset');
});

test('the amount uses the rate from the current reading', () => {
  // Documented limitation: the device exposes a usage counter, not a
  // per-transaction price, so a rate change mid-window is priced at the new
  // rate. Stated rather than hidden.
  const events = diffSnapshots(
    snap([P(0, 'WASH', 11, 100)]),
    snap([P(0, 'WASH', 10, 50)])
  );

  assert.equal(events[0].amount, 100, 'priced at the rate read now');
});

/* ---- the parser must supply the slot the diff relies on ---- */

test('parseNaekPage assigns each product its row index as the slot', () => {
  const html = `
    <html><b>NAEK</b>
    <input name="shopName" value="QuickWash">
    <input name="lcdSleep" value="60">
    <b>Credits:</b> 42
    <table>
      <tr><th>PRODUCT</th></tr>
      <tr><td>WASH</td><td>50</td><td>600</td><td><span>ON</span></td><td>10</td><td><b>900</b></td></tr>
      <input name='ppauseEn0' checked>
      <tr><td>DRY</td><td>40</td><td>480</td><td><span>OFF</span></td><td>3</td><td><b>120</b></td></tr>
      <input name='ppauseEn1'>
    </table>
    <th>TOTAL SALES:</th><th>1020</th>
    </html>`;

  const parsed = parseNaekPage(html);

  assert.equal(parsed.products.length, 2);
  assert.equal(parsed.products[0].slot, 0);
  assert.equal(parsed.products[1].slot, 1);
  assert.equal(parsed.products[0].name, 'WASH');
  assert.equal(parsed.products[1].status, 'OFF');
  assert.equal(parsed.credits, 42);
  assert.equal(parsed.totalSales, 1020);
  assert.equal(parsed.shopName, 'QuickWash');
  assert.equal(parsed.lcdSleep, 60);
});

test('parseNaekPage carries pause state per slot', () => {
  const html = `
    <html><b>NAEK</b>
    <table>
      <tr><td>WASH</td><td>50</td><td>600</td><td><span>ON</span></td><td>1</td><td><b>1</b></td></tr>
      <input name='ppauseEn0' checked>
      <tr><td>DRY</td><td>40</td><td>480</td><td><span>ON</span></td><td>1</td><td><b>1</b></td></tr>
      <input name='ppauseEn1'>
    </table>
    </html>`;

  const parsed = parseNaekPage(html);

  assert.equal(parsed.products[0].pause, true);
  assert.equal(parsed.products[1].pause, false);
});

test('parseNaekPage rejects a page that is not the NAEK UI', () => {
  assert.throws(() => parseNaekPage('<html><body>login</body></html>'), /NAEK/);
});

test('parseNaekPage rejects a page with no product rows', () => {
  assert.throws(() => parseNaekPage('<html><b>NAEK</b><b>Credits:</b> 1</html>'), /product rows/);
});