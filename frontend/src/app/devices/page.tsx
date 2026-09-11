"use client";

import Header from '@/components/Header';
import { Cpu, Wifi, Activity, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface DeviceItem {
  id: string;
  name: string;
  type: string;
  ip: string | null;
  status: string;
  uptime: string;
  lastPing: string;
}

const defaultDevices: DeviceItem[] = [
  { id: 'esp32_bay_1', name: 'Main Controller', type: 'ESP32', ip: null, status: 'offline', uptime: '0m', lastPing: 'never' },
  { id: 'esp32_cam_1', name: 'Bay Camera', type: 'ESP32-CAM', ip: null, status: 'offline', uptime: '0m', lastPing: 'never' },
  { id: 'esp32_vending', name: 'Coin Acceptor Node', type: 'ESP32', ip: null, status: 'offline', uptime: '0m', lastPing: 'never' },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState(defaultDevices);
  const [onlineCount, setOnlineCount] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await api.getDevices();
        setDevices(data);
        setOnlineCount(data.filter((d: DeviceItem) => d.status === 'online').length);
      } catch {
        console.warn('Devices backend unavailable');
      }
    };
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async (deviceId: string) => {
    setSendingId(deviceId);
    try {
      await api.sendCommand(deviceId, 'reset_jam');
    } catch (err) {
      console.warn('Failed to send command:', err);
    }
    setSendingId(null);
  };

  return (
    <>
      <Header title="Device Fleet" subtitle="Manage IoT hardware nodes" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        
        {/* Device KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
              <Cpu className="text-[var(--accent)]" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Total Nodes</p>
              <h3 className="text-xl font-bold font-ui">{devices.length} Devices</h3>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex items-center justify-center shrink-0">
              <Wifi className="text-[var(--text-muted)]" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Status</p>
              <h3 className="text-xl font-bold font-ui" style={{color: onlineCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{onlineCount} Online</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {devices.map(device => (
            <div key={device.id} className="card relative overflow-hidden group p-4 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg truncate uppercase tracking-tight font-ui">{device.name}</h3>
                    <p className="text-[10px] sm:text-xs truncate opacity-60" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{device.id}</p>
                  </div>
                  <span className={`badge shrink-0 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${device.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
                    {device.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                <div className="space-y-2 sm:space-y-3 mt-4 sm:mt-6" style={{ fontFamily: 'var(--font-mono)' }}>
                  <div className="flex justify-between text-[11px] sm:text-xs lg:text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>TYPE</span>
                    <span style={{ color: 'var(--accent)' }} className="font-bold">{device.type}</span>
                  </div>
                  <div className="flex justify-between text-[11px] sm:text-xs lg:text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>IP ADDR</span>
                    <span className="truncate ml-4 text-[var(--text-primary)]">{device.ip || '--'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] sm:text-xs lg:text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>UPTIME</span>
                    <span className="text-[var(--text-primary)]">{device.uptime}</span>
                  </div>
                  <div className="flex justify-between text-[11px] sm:text-xs lg:text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>LAST PING</span>
                    <span className="text-[var(--text-primary)]">{device.lastPing}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 flex gap-2 sm:gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => handleRestart(device.id)}
                  disabled={sendingId === device.id}
                  className="btn btn-ghost flex-1 py-2 text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={sendingId === device.id ? 'animate-spin' : ''} /> <span>{sendingId === device.id ? 'Sending' : 'Reset Jam'}</span>
                </button>
                <button className="btn btn-ghost flex-1 py-2 text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]">
                  <Activity size={14} /> <span>Logs</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
