const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const LOGIN_REQUEST_TIMEOUT_MS = 75_000; // Render free instances can take 50s+ to wake.

// Session marker cookie. The REAL auth is the Bearer token in localStorage;
// this cookie only feeds the server-side UX gate (src/middleware.ts + the
// camera proxy). It is set by the FRONTEND on its own origin, so it works no
// matter where the Laravel API lives — unlike the API's HttpOnly cookie,
// which is host-scoped to the API and invisible to the dashboard's origin.
const SESSION_COOKIE = 'qhs_session';
const SESSION_COOKIE_TTL_SECONDS = 8 * 60 * 60; // mirrors SANCTUM_TOKEN_EXPIRATION
const SESSION_COOKIE_ATTRS = `path=/; max-age=${SESSION_COOKIE_TTL_SECONDS}; SameSite=Lax`;

function setSessionCookie() {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=1; ${SESSION_COOKIE_ATTRS}${secure}`;
}

function clearSessionCookie() {
  if (typeof window === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

/** Typed login failures for actionable form feedback. */
export type LoginErrorKind = 'credentials' | 'network' | 'timeout' | 'server';

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
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request(
    path: string,
    options: RequestInit = {},
    opts: { skipAuthRedirect?: boolean; timeoutMs?: number } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
      localStorage.removeItem('isAuthenticated');
      clearSessionCookie();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errBody = body as { message?: string; error?: string } | null;
      throw new Error(errBody?.message || errBody?.error || `Request failed (${res.status})`);
    }

    return body;
  }

  get(path: string) {
    return this.request(path);
  }

  post(path: string, data?: Record<string, unknown>, opts: { skipAuthRedirect?: boolean; timeoutMs?: number } = {}) {
    return this.request(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, opts);
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
  async login(email: string, password: string) {
    try {
      const data = await this.post(
        '/auth/login',
        { email, password },
        { skipAuthRedirect: true, timeoutMs: LOGIN_REQUEST_TIMEOUT_MS }
      );
      this.setToken(data.token);
      localStorage.setItem('isAuthenticated', 'true');
      setSessionCookie();
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

  async logout() {
    try { await this.post('/auth/logout'); } catch {}
    this.setToken(null);
    localStorage.removeItem('isAuthenticated');
    clearSessionCookie();
  }

  async getUser() {
    return this.get('/auth/user');
  }

  // Profile
  getProfile() { return this.get('/profile'); }
  updateProfile(data: Record<string, unknown>) { return this.put('/profile', data); }
  updatePreferences(data: Record<string, unknown>) { return this.put('/profile/preferences', data); }

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
}

export const api = new ApiClient();