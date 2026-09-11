const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
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

    if (res.status === 401) {
      this.setToken(null);
      localStorage.removeItem('isAuthenticated');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    const text = await res.text().catch(() => '');
    let body;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    } else {
      body = null;
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

  post(path: string, data?: Record<string, unknown>) {
    return this.request(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
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
    const data = await this.post('/auth/login', { email, password });
    this.setToken(data.token);
    localStorage.setItem('isAuthenticated', 'true');
    return data;
  }

  async logout() {
    try { await this.post('/auth/logout'); } catch {}
    this.setToken(null);
    localStorage.removeItem('isAuthenticated');
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