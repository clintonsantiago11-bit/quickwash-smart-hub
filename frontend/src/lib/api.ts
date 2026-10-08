const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const LOGIN_REQUEST_TIMEOUT_MS = 75_000; // Render free instances can take 50s+ to wake.

// Session marker cookie. The REAL auth is the Bearer token in the browser's
// storage; this cookie only feeds the server-side UX gate (src/middleware.ts +
// the camera proxy). It is set by the FRONTEND on its own origin, so it works
// no matter where the Laravel API lives — unlike the API's HttpOnly cookie,
// which is host-scoped to the API and invisible to the dashboard's origin.
const SESSION_COOKIE = 'qhs_session';
const SESSION_COOKIE_TTL_SECONDS = 8 * 60 * 60; // mirrors SANCTUM_TOKEN_EXPIRATION

/**
 * Fired when the API rejects the stored token. The root layout listens and
 * routes to /login client-side. Exported so the listener and the dispatcher
 * cannot drift apart.
 */
export const UNAUTHORIZED_EVENT = 'quickwash:unauthorized';

/**
 * The cookie is written with a lifetime only when the operator asked to stay
 * signed in. Without it, it is a session cookie: closing the browser ends the
 * session, which is the safe default for a shared terminal.
 */
function setSessionCookie(persistent: boolean) {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = persistent ? `; max-age=${SESSION_COOKIE_TTL_SECONDS}` : '';
  document.cookie = `${SESSION_COOKIE}=1; path=/${maxAge}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  if (typeof window === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
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
 * The signed-in marker follows the token, so a stale flag from a previous
 * session cannot claim a session that has gone.
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
      clearSessionCookie();

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
      throw Object.assign(new Error(message), { status: res.status });
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
      setSessionCookie(keepSignedIn);
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
    clearSessionCookie();
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