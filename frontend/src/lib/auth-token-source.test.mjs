import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(p, 'utf8');
const ROOT = 'C:/xampp/htdocs/xampp/Capstone Project/QuickWash-Smart-Hub/frontend/';

// The socket service had its own sendCommand that read localStorage only. With
// "keep me signed in" unticked - the default - the token is in sessionStorage,
// so it would have sent `Bearer null`. Every caller uses api.sendCommand, which
// is correct, but the duplicate was a loaded gun.
test('socket.ts no longer reads the token from storage itself', () => {
  const socket = source(ROOT + 'src/lib/socket.ts');
  assert.doesNotMatch(
    socket,
    /localStorage\.getItem\('auth_token'\)/,
    'the token must be resolved by api.ts, which reads both stores',
  );
});

test('socket.ts no longer builds its own Authorization header', () => {
  const socket = source(ROOT + 'src/lib/socket.ts');
  assert.doesNotMatch(socket, /Authorization.*Bearer/, 'no hand-rolled auth header');
});

test('socket.sendCommand delegates to api.sendCommand', () => {
  const socket = source(ROOT + 'src/lib/socket.ts');
  assert.match(socket, /api\.sendCommand\(deviceId, action\)/);
});

test('api.sendCommand is the single implementation and attaches the token', () => {
  const api = source(ROOT + 'src/lib/api.ts');
  assert.match(api, /sendCommand\(deviceId: string, action: string\) \{ return this\.post\(`/);
  // The client resolves the token in one place, reading both stores.
  assert.match(api, /window\.localStorage\.getItem\(TOKEN_KEY\) \?\? window\.sessionStorage\.getItem\(TOKEN_KEY\)/);
});

test('readStoredToken is private to api.ts', () => {
  const api = source(ROOT + 'src/lib/api.ts');
  assert.match(api, /^function readStoredToken/m, 'not exported - callers must use hasStoredSession/api');
  assert.doesNotMatch(api, /^export function readStoredToken/m);
});

test('hasStoredSession is exported for the route guard', () => {
  const api = source(ROOT + 'src/lib/api.ts');
  assert.match(api, /export function hasStoredSession\(\): boolean/);
});

test('LayoutContent gates on hasStoredSession, not on a storage flag', () => {
  const layout = source(ROOT + 'src/components/LayoutContent.tsx');
  assert.match(layout, /import \{ hasStoredSession \} from '@\/lib\/api'/);
  assert.match(layout, /!hasStoredSession\(\)/);
  assert.doesNotMatch(
    layout,
    /getItem\('isAuthenticated'\)/,
    "reading the string 'false' as a boolean is what broke the guard",
  );
  assert.doesNotMatch(layout, /getItem\('auth_token'\)/, 'the token lookup lives in api.ts');
});

test('no component gates auth on the isAuthenticated flag', () => {
  for (const f of ['LayoutContent.tsx', 'Sidebar.tsx', 'Header.tsx']) {
    assert.doesNotMatch(
      source(ROOT + 'src/components/' + f),
      /getItem\('isAuthenticated'\)/,
      f + ' must not treat a storage string as a boolean',
    );
  }
});
