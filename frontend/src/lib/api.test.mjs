import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const storage = new Map();

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { protocol: 'https:' },
  },
});
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { cookie: '' },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
});

test('login waits for a Render free-instance cold start', async (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['setTimeout'] });

  globalThis.fetch = (_input, init) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(new Response(JSON.stringify({ token: 'issued-token', user: { id: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }, 20_000);

    init?.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

  const { api } = await import('./api.ts');
  const login = api.login('operator@example.com', 'valid-password');
  mock.timers.tick(20_000);

  const result = await login;
  assert.equal(result.token, 'issued-token');
});
