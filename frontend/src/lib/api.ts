const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const LOGIN_REQUEST_TIMEOUT_MS = 75_000; // Render free instances can take 50s+ to wake.

/**
 * Session cookie for the camera proxy.
 *
 * The REAL auth is the Sanctum Bearer token above. This cookie exists only
 * because two camera consumers cannot send an Authorization header - an
 * <iframe> navigation carries cookies but no custom headers, and the ESP32-CAM
 * has no authentication of its own, so the proxy has to be the boundary.
 *
 * It is minted by POST /api/session, which asks Laravel to vouch for the
 * bearer token first, and it is HttpOnly + signed server-side. That means the
 * browser can neither read nor forge it - and equally, it cannot clear it.
 * Clearing goes through DELETE /api/session, which is why both helpers below
 * are async and touch the network.
 */

/**
 * Fired when the API rejects the stored token. The root layout listens and
 * routes to /login client-side. Exported so the listener and the dispatcher
 * cannot drift apart.
 */
export const UNAUTHORIZED_EVENT = 'quickwash:unauthorized';

/**
 * Ask the server to mint (or refresh) the signed session cookie.
 *
 * The bearer token is the only thing presented; the server decides whether it
 * is still good by asking Laravel. A failure here is deliberately NOT fatal to
 * sign-in: every other part of the dashboard works on the bearer token alone,
 * and only the camera proxy needs this cookie. Losing the camera feed is a
 * worse outcome than losing it on a stale cookie, so it is logged and left to
 * expire rather than turned into a rejected password.
 */
async function syncSessionCookie(token: string, persistent: boolean): Promise<void> {
  try {
    await fetch('/api/session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      // The cookie is HttpOnly, so the server owns its lifetime. It has to be
      // told, or every cookie becomes a persistent one and a shared terminal
      // keeps camera access until the full 8 hours are up.
      body: JSON.stringify({ persistent }),
    });
  } catch {
    /* offline or the route is unavailable; the bearer token still works */
  }
}

/**
 * Clear the session cookie. It is HttpOnly, so document.cookie cannot touch
 * it and this has to be a server round trip.
 */
async function revokeSessionCookie(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    /* best effort - the cookie is signed and will expire on its own */
  }
}

/** Typed login failures for actionable form feedback. */
export type LoginErrorKind = 'credentials' | 'network' | 'timeout' | 'server';

const TOKEN_KEY = 'auth_token';
const AUTH_FLAG_KEY = 'isAuthenticated';

/** Reads the token from either store, preferring the persistent one. */
function readStoredToken(): string | null {
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Whether this browser currently holds a session.
 *
 * Exported so the route guard does not have to re-derive it. The previous
 * version of the guard did exactly that and got it wrong in a way that was
 * invisible: it read `localStorage.getItem('isAuthenticated')`, which is the
 * STRING 'false' when "keep me signed in" was unticked - and a non-empty
 * string is truthy, so `!isAuth` was always false and the redirect to /login
 * never fired for anyone. It looked like it worked because an API 401 does
 * eventually route them out; the guard itself was inert.
 *
 * The token is the source of truth, and it lives in sessionStorage unless the
 * operator opted into persistence. Both stores are checked, because a new tab
 * has fresh sessionStorage but may still hold a persisted token.
 */
export function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  return readStoredToken() !== null;
}

/**
 * The signed-in marker follows the token, so a stale flag from a previous
 * session cannot claim a session that has gone.
 *
 * It is informational only - nothing should gate on it, because a string in
 * storage is too easy to read as a boolean by accident. See
 * hasStoredSession() for the real check.
 */
function writeAuthFlag(persistent: boolean) {
  try {
    window.localStorage.setItem(AUTH_FLAG_KEY, persistent ? 'true' : 'false');
  } catch {
    /* private browsing */
  }
}

function clearAuthFlag() {
  try {
    window.localStorage.removeItem(AUTH_FLAG_KEY);
    window.sessionStorage.removeItem(AUTH_FLAG_KEY);
  } catch {
    /* private browsing */
  }
}

export class LoginError extends Error {
  readonly kind: LoginErrorKind;

  constructor(kind: LoginErrorKind, message: string) {
    super(message);
    this.name = 'LoginError';
    this.kind = kind;
  }
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = readStoredToken();
    }
  }

  /**
   * `keepSignedIn` decides where the token lives.
   *
   * localStorage survives closing the browser, so it is opt-in. By default the
   * token goes in sessionStorage, which the browser discards with the tab, so
   * closing the terminal actually ends the session rather than leaving a live
   * one for whoever opens it next.
   *
   * Both stores are always read, so a token written before this change, or by
   * an older build, is still found and nobody is logged out by deploying.
   */
  setToken(token: string | null, keepSignedIn = true) {
    this.token = token;
    if (typeof window === 'undefined') return;

    // Exactly one store holds the token, so switching the checkbox clears the
    // other one rather than leaving a copy behind that outlives the choice.
    const primary = keepSignedIn ? window.localStorage : window.sessionStorage;
    const other = keepSignedIn ? window.sessionStorage : window.localStorage;

    try {
      if (token) {
        primary.setItem(TOKEN_KEY, token);
        other.removeItem(TOKEN_KEY);
      } else {
        primary.removeItem(TOKEN_KEY);
        other.removeItem(TOKEN_KEY);
      }
    } catch {
      // Private browsing can refuse storage; the in-memory token still works
      // for this tab.
    }
  }

  getToken() {
    if (!this.token && typeof window !== 'undefined') this.token = readStoredToken();
    return this.token;
  }

  private async request(
    path: string,
    options: RequestInit = {},
    opts: {
      skipAuthRedirect?: boolean;
      timeoutMs?: number;
      /** Send this token rather than the stored one. Used by sign-out, which
       *  runs after the stored token has already been cleared. */
      explicitToken?: string | null;
    } = {}
  ) {
    // A FormData body must go out untouched, and Content-Type has to be left
    // alone so the browser can add the multipart boundary. Setting it by hand
    // produces a request the server cannot parse.
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    Object.assign(headers, { ...(options.headers as Record<string, string> | undefined) });

    const token = opts.explicitToken !== undefined ? opts.explicitToken : this.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }


    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        // Send/receive cookies on the API origin (the API's HttpOnly
        // `auth_token` cookie is stored there). Real auth is the Bearer
        // header; the dashboard's own gate uses the `qhs_session` cookie.
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw new Error('Network error - server unreachable');
    }
    clearTimeout(timer);

    const text = await res.text().catch(() => '');
    let body;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (res.status === 401) {
      // The login route must surface 401 as a typed rejection instead of
      // bouncing the visitor (who is already on /login).
      if (opts.skipAuthRedirect) {
        const errBody = body as { message?: string } | null;
        throw new LoginError('credentials', errBody?.message || 'Invalid email or password.');
      }
      this.setToken(null);
      clearAuthFlag();
      // Not awaited: this runs on the rejection path, and the dispatch below
      // is what takes the operator to /login. Nothing may sit in front of it.
      void revokeSessionCookie();

      // Ask the shell to navigate, rather than assigning location.href.
      // A hard navigation tears down the whole app, so an expired token
      // silently discarded whatever the operator had on screen, mid-form,
      // with no explanation. The root layout listens for this and routes
      // client-side, which keeps the transition soft.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      throw new Error('Unauthorized');
    }

if (!res.ok) {
        const errBody = body as { message?: string; error?: string } | null;
        const message = errBody?.message || errBody?.error || `Request failed (${res.status})`;
        // Carry the status so a caller can tell "you may not see this" (403)
        // apart from "this is broken" (500). Without it the audit page could
        // only guess, and showed a blank table to anyone who is not an admin.
        //
        // `body` has to come along too. A 422 from Laravel carries a per-field
        // `errors` map, and fieldErrorsFrom() reads it to put the message beside
        // the offending input. Throwing the status alone meant that helper
        // always got undefined and every validation failure collapsed into one
        // generic "we could not save" banner with no field marked.
        throw Object.assign(new Error(message), { status: res.status, body });
      }

    return body;
  }

  get(path: string) {
    return this.request(path);
  }

  post(
    path: string,
    data?: Record<string, unknown>,
    opts: { skipAuthRedirect?: boolean; timeoutMs?: number; form?: FormData } = {}
  ) {
    const { form, ...rest } = opts;
    return this.request(
      path,
      { method: 'POST', body: form ?? (data ? JSON.stringify(data) : undefined) },
      rest
    );
  }

  put(path: string, data?: Record<string, unknown>) {
    return this.request(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch(path: string, data?: Record<string, unknown>) {
    return this.request(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Auth
  async login(email: string, password: string, keepSignedIn = true) {
    try {
      const data = await this.post(
        '/auth/login',
        { email, password },
        { skipAuthRedirect: true, timeoutMs: LOGIN_REQUEST_TIMEOUT_MS }
      );
      this.setToken(data.token, keepSignedIn);
      writeAuthFlag(keepSignedIn);
      // Deliberately not awaited. Only the camera proxy needs this cookie -
      // every other part of the dashboard works on the bearer token - so a slow
      // or unreachable cookie route must never be able to delay or fail a
      // sign-in. It settles on its own, and the camera page retries anyway.
      void syncSessionCookie(data.token, keepSignedIn);
      return data;
    } catch (err) {
      if (err instanceof LoginError) throw err;
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('timed out')) {
        throw new LoginError('timeout', 'Connection timed out — signal too weak.');
      }
      if (msg.includes('Network error')) {
        throw new LoginError('network', 'No signal — the hub is unreachable.');
      }
      // Laravel reports bad credentials as 422 with this message; 401 covers Sanctum-style rejections.
      if (/credential|incorrect|unauthorized|invalid|password/i.test(msg)) {
        throw new LoginError('credentials', 'The provided credentials are incorrect.');
      }
      throw new LoginError('server', msg || 'Machine error — try again.');
    }
  }

  /**
   * Revokes the token on the server, then clears the browser session.
   *
   * The token is captured first and sent explicitly. Reading it from `this`
   * instead is what made sign-out leave a live token behind: the idle timeout
   * clears the token before calling this, so the request went out with no
   * Authorization header, came back 401, and was swallowed — leaving the row
   * valid for the whole eight hours.
   */
  async logout() {
    const token = this.getToken();
    try {
      await this.request('/auth/logout', { method: 'POST' }, { explicitToken: token });
    } catch {
      // A failed revocation must still end the local session. The server-side
      // row then expires on its own.
    }
    this.setToken(null);
    clearAuthFlag();
    await revokeSessionCookie();
  }

  async getUser() {
    return this.get('/auth/user');
  }

  // Profile
  getProfile() { return this.get('/profile'); }
  updateProfile(data: Record<string, unknown>) { return this.put('/profile', data); }
  updatePreferences(data: Record<string, unknown>) { return this.put('/profile/preferences', data); }
  changePassword(data: { current_password: string; password: string; password_confirmation: string }) {
    return this.put('/profile/password', data);
  }
  getProfileActivity(limit = 10) { return this.get(`/profile/activity?limit=${limit}`); }
  getFacilities() { return this.get('/profile/facilities'); }
  uploadAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return this.post('/profile/avatar', undefined, { form });
  }

  // Devices
  getDevices() { return this.get('/devices'); }
  sendCommand(deviceId: string, action: string) { return this.post(`/devices/${deviceId}/command`, { action }); }

  // Alerts
  getAlerts() { return this.get('/alerts'); }
  resolveAlert(id: number) { return this.patch(`/alerts/${id}/resolve`); }

  // Vending
  getTransactions() { return this.get('/vending/transactions'); }
  getVendingStats() { return this.get('/vending/stats'); }
  getVendoSettings() { return this.get('/vending/settings'); }
  updateVendoSettings(data: Record<string, unknown>) { return this.put('/vending/settings', data); }

  // NAEK device mirror (2-way config sync)
  getNaekConfig(deviceId = 'naek_carwash_1') { return this.get(`/naek/config?device_id=${deviceId}`); }
  updateNaekConfig(data: Record<string, unknown>) { return this.put('/naek/config', data); }

  // Analytics
  getRevenue(days = 7) { return this.get(`/analytics/revenue?days=${days}`); }
  getPeakHours() { return this.get('/analytics/peak-hours'); }

  // Dashboard
  getDashboardStats() { return this.get('/dashboard/stats'); }

  // System settings
  // Any signed-in user may read (a technician needs to see the thresholds to
  // diagnose an alert); the write is gated by role and returns 403 otherwise,
  // so the page uses `can_edit` from the read to hide the button.
  getSystemSettings() { return this.get('/settings'); }
  updateSystemSettings(data: Record<string, unknown>) { return this.put('/settings', data); }

  // Audit
  getAuditLogs(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/audit-logs${qs}`);
  }

  /**
   * What the retention job will delete, so the dashboard can warn before
   * anything is lost rather than after.
   */
  getAuditRetention(days?: number) {
    const qs = days ? `?days=${days}` : '';
    return this.get(`/audit-logs/retention${qs}`);
  }
}

export const api = new ApiClient();