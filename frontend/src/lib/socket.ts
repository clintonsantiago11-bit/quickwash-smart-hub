import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

interface HardwareUpdatePayload {
  topic: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface NaekProduct {
  name: string;
  rate: number;
  duration: number;
  status: 'ON' | 'OFF';
  usage: number;
  net: number;
  pause?: boolean;
}

export interface NaekSnapshot {
  shopName: string;
  lcdSleep?: number;
  credits: number;
  totalSales: number;
  products: NaekProduct[];
}

export interface NaekEvent {
  type: 'sale' | 'sales_reset' | 'total_reset';
  product?: string;
  count?: number;
  amount?: number;
  durationSeconds?: number;
}

export interface NaekUpdatePayload {
  deviceId: string;
  snapshot: NaekSnapshot;
  events: NaekEvent[];
  timestamp: string;
}

export interface NaekConfigPayload {
  deviceId: string;
  shopName: string;
  lcdSleep: number;
  products: NaekProduct[];
  credits: number;
  totalSales: number;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private hardwareListeners: ((payload: HardwareUpdatePayload) => void)[] = [];
  private naekListeners: ((payload: NaekUpdatePayload) => void)[] = [];
  private configListeners: ((payload: NaekConfigPayload) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect() {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.socket = io(WS_URL, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      console.log('🔗 Connected to IoT Bridge');
      this.notifyConnectionListeners(true);
    });

    this.socket.on('disconnect', () => {
      console.warn('❌ Disconnected from IoT Bridge');
      this.notifyConnectionListeners(false);
    });

    this.socket.on('connect_error', () => {
      this.notifyConnectionListeners(false);
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 5000);
      }
    });

    this.socket.on('hardware_update', (payload: HardwareUpdatePayload) => {
      this.hardwareListeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.error('hardware_update handler error:', e); }
      });
    });

    this.socket.on('naek_update', (payload: NaekUpdatePayload) => {
      this.naekListeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.error('naek_update handler error:', e); }
      });
    });

    this.socket.on('naek_config', (payload: NaekConfigPayload) => {
      this.configListeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.error('naek_config handler error:', e); }
      });
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(cb => {
      try { cb(connected); } catch (e) { console.error(e); }
    });
  }

  onHardwareUpdate(callback: (payload: HardwareUpdatePayload) => void) {
    this.hardwareListeners.push(callback);
    return () => {
      this.hardwareListeners = this.hardwareListeners.filter(cb => cb !== callback);
    };
  }

  onNaekUpdate(callback: (payload: NaekUpdatePayload) => void) {
    this.naekListeners.push(callback);
    return () => {
      this.naekListeners = this.naekListeners.filter(cb => cb !== callback);
    };
  }

  onNaekConfig(callback: (payload: NaekConfigPayload) => void) {
    this.configListeners.push(callback);
    return () => {
      this.configListeners = this.configListeners.filter(cb => cb !== callback);
    };
  }

  sendCommand(deviceId: string, action: string) {
    fetch(`${API_BASE}/devices/${deviceId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ action }),
    }).catch(err => console.error('Failed to send command:', err));
  }
}

export const socketService = new SocketService();