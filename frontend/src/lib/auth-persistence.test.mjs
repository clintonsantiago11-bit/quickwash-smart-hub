import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const api = source('./api.ts');
const form = source('../components/login/CredentialForm.tsx');
const page = source('../app/login/page.tsx');

/**
 * The email and the session length were the same checkbox, which could not
 * be right: un-ticking it deleted the stored email, so the email was never
 * really pre-filled, and it was on by default so the session always
 * outlived the browser. They are now separate.
 */
test('the email is always remembered, whatever the checkbox says', () => {
  // No branch that deletes it any more.
  assert.doesNotMatch(page, /removeItem\('remembered_email'\)/);
  assert.match(page, /localStorage\.setItem\('remembered_email', credentials\.email\.trim\(\)\)/);
  assert.match(form, /localStorage\.getItem\('remembered_email'\)/);
});

test('the checkbox is about the session, not the email, and defaults to off', () => {
  assert.match(form, /Keep me signed in/);
  assert.match(form, /const \[keepSignedIn, setKeepSignedIn\] = useState\(false\)/);
  assert.doesNotMatch(form, /Remember email/);
  assert.match(form, /onSubmit\(\{ email, password, keepSignedIn \}\)/);
});

test('the token only survives a browser restart when that box is ticked', () => {
  // Both stores are always read, so a token written by an older build, or
  // before this change, is still found and nobody is logged out by deploying.
  assert.match(
    api,
    /window\.localStorage\.getItem\(TOKEN_KEY\) \?\? window\.sessionStorage\.getItem\(TOKEN_KEY\)/,
    'a token must be found in either store',
  );

  // Exactly one store holds it, so switching the choice cannot leave a copy
  // behind that outlives the decision.
  assert.match(api, /const primary = keepSignedIn \? window\.localStorage : window\.sessionStorage;/);
  assert.match(api, /primary\.setItem\(TOKEN_KEY, token\);\s*\n\s*other\.removeItem\(TOKEN_KEY\);/);
});

/**
 * The session cookie is minted server-side now, so these assertions check that
 * the browser no longer owns it and that "keep me signed in" still reaches the
 * server that does.
 *
 * The cookie used to be written from JavaScript as `qhs_session=1`, which the
 * camera proxy accepted on the strength of the cookie existing at all. That is
 * why the lifetime logic lived here. The value is signed and HttpOnly now, so
 * the browser cannot write it or read it - and consequently cannot delete it
 * either, which is what DELETE /api/session exists for.
 */
test('the session cookie is minted server-side, not written from the browser', () => {
  const route = source('../app/api/session/route.ts');

  // No client-side cookie writing at all for this cookie.
  assert.doesNotMatch(api, /document\.cookie\s*=\s*`\$\{SESSION_COOKIE\}/);
  assert.doesNotMatch(api, /function setSessionCookie/);

  // It is minted by a route that asks Laravel to vouch for the bearer token,
  // and it is HttpOnly so it cannot be forged or cleared from the browser.
  assert.match(route, /fetch\(`\$\{API_BASE\}\/auth\/user`/);
  assert.match(route, /httpOnly: true/);
  assert.match(api, /void syncSessionCookie\(data\.token, keepSignedIn\)/);
});

test('the checkbox still governs how long the cookie lives', () => {
  const route = source('../app/api/session/route.ts');

  // The server is told the choice rather than assuming a persistent cookie.
  assert.match(route, /persistent = body\.persistent/);
  assert.match(route, /\.\.\.\(persistent \? \{ maxAge: minutes \* 60 \} : \{\}\)/);

  // And clearing it is a server round trip, because HttpOnly means
  // document.cookie cannot expire it.
  assert.match(api, /void revokeSessionCookie\(\)/);
  assert.match(api, /await revokeSessionCookie\(\)/);
});

test('login keeps its signature', () => {
  assert.match(api, /async login\(email: string, password: string, keepSignedIn = true\)/);
});

test('the signed-in marker follows the token so a stale flag cannot lie', () => {
  assert.match(api, /function clearAuthFlag\(\)/);
  // Both the 401 path and an explicit sign-out must clear it.
  const clears = api.match(/clearAuthFlag\(\);/g) ?? [];
  assert.ok(clears.length >= 2, 'both the 401 handler and logout must clear the flag');
});
