import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(p, 'utf8');
const ROOT = 'C:/xampp/htdocs/xampp/Capstone Project/QuickWash-Smart-Hub/frontend/';
const page = source(ROOT + 'src/app/settings/page.tsx');

// The page wrote the broker host, port and thresholds to localStorage under
// qw_settings and read them back from nowhere. An operator could change a
// low-water percentage, press Save, see "Saved to this browser", and the
// machine carried on ignoring it.
test('the settings page no longer stores anything in localStorage', () => {
  assert.doesNotMatch(
    page,
    /qw_settings/,
    'qw_settings was written by this page and read by nothing else',
  );
  assert.doesNotMatch(page, /localStorage\.(setItem|getItem)/, 'settings must come from the server');
});

test('the settings page reads and writes through the API client', () => {
  assert.match(page, /api\.getSystemSettings\(\)/);
  assert.match(page, /api\.updateSystemSettings\(/);
});

test('api.ts exposes both settings endpoints', () => {
  const api = source(ROOT + 'src/lib/api.ts');
  assert.match(api, /getSystemSettings\(\) \{ return this\.get\('\/settings'\); \}/);
  assert.match(api, /updateSystemSettings\(data: Record<string, unknown>\) \{ return this\.put\('\/settings', data\); \}/);
});

test('the page does not claim values saved to a browser', () => {
  // Checked against the rendered JSX, not the whole file: the doc comment
  // quotes the old wording to explain what it replaced, which is fine.
  const jsx = page.slice(page.indexOf('export default function'));
  assert.doesNotMatch(
    jsx,
    /Saved to this browser/,
    'that wording is what made the page honest-but-useless',
  );
});

test('the page says a saved broker does not move a live connection', () => {
  // The MQTT socket is held by the bridge process and built from its own
  // environment. Without this the Save button implies a change took effect.
  assert.match(page, /pendingRestartNote|restart/i);
  assert.match(page, /broker_in_effect|brokerInEffect/);
});

test('thresholds are labelled as pending rather than live', () => {
  assert.match(page, /next cycle/i);
});

test('a technician sees a read-only notice instead of a button that 403s', () => {
  assert.match(page, /canEdit/);
  assert.match(page, /disabled=\{!canEdit/);
  // The page says "admins and managers" in prose and renders the hyphen
  // entity, so match either spelling.
  assert.match(page, /admins and managers/i);
});

test('the page has real loading, error and saving states', () => {
  assert.match(page, /Loading settings/);
  assert.match(page, /ErrorState/);
  assert.match(page, /setSaving/);
  assert.match(page, /Saving?/);
});

test('polling stands down while the form is dirty', () => {
  // Otherwise a poll replaces the field being typed into, which is the bug
  // the vendo page was fixed for.
  assert.match(page, /dirtyRef/);
  assert.match(page, /if \(dirtyRef\.current\) return prev;/);
  assert.match(page, /usePolling\(/);
});

test('every input has a label bound to it', () => {
  const labels = page.match(/<label/g) ?? [];
  const htmlFor = page.match(/htmlFor=/g) ?? [];
  const inputs = page.match(/<input/g) ?? [];
  assert.ok(labels.length > 0, 'there are labels');
  assert.ok(htmlFor.length > 0, 'labels are bound with htmlFor');
  // Each labelled control needs an id to bind to.
  const ids = page.match(/\bid=\{?['"]?[\w-]+/g) ?? [];
  assert.ok(ids.length >= inputs.length - 1, 'inputs carry ids');
});

test('invalid fields are announced to assistive tech', () => {
  assert.match(page, /aria-invalid/);
  assert.match(page, /aria-describedby/);
  assert.match(page, /role="alert"/);
});

test('the saved timer is cleaned up on unmount', () => {
  assert.match(page, /clearTimeout\(savedTimer\.current\)/);
});

test('validation runs before the request so errors name the field', () => {
  assert.match(page, /validateSettings\(settings\)/);
  assert.match(page, /hasErrors\(found\)/);
});

test('the page does not fabricate an identity when the profile fails', () => {
  // It used to fall back to "System Administrator / admin@quickwash.hub",
  // so a failed load looked like a confident signed-in admin.
  assert.doesNotMatch(page, /System Administrator/);
  assert.doesNotMatch(page, /admin@quickwash\.hub/);
  assert.match(page, /adminUser\?\.full_name \?\? '?'/);
});
