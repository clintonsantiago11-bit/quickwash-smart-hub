"use client";

import Header from '@/components/Header';
import { 
  TrendingUp, 
  Waves, 
  Cpu, 
  AlertTriangle, 
  Zap,
  Play,
  Square,
  RotateCcw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';

interface DeviceItem {
  id: string;
  name: string;
  type: string;
  ip: string | null;
  status: string;
  uptime: string;
  lastPing: string;
}

interface BayState {
  online: boolean;
  hasStatus: boolean;
  status: 'active' | 'available' | 'error';
  progress: number;
  currentCycle: string;
  cycleType: string;
}

interface StatCard {
  label: string;
  value: string;
  change?: string;
  subValue?: string;
  icon: typeof TrendingUp;
  color: string;
}

interface SupplyItem {
  label: string;
  level: number | null;
  color: string;
}

const defaultBay: BayState = {
  online: false,
  hasStatus: false,
  status: 'available',
  progress: 0,
  currentCycle: '—',
  cycleType: '—',
};

const STAT_ICONS: Record<string, { icon: typeof TrendingUp; color: string }> = {
  "Today's Revenue": { icon: TrendingUp, color: 'var(--text-muted)' },
  'Active Washes': { icon: Waves, color: 'var(--text-muted)' },
  'Devices Online': { icon: Cpu, color: 'var(--text-muted)' },
  'Active Alerts': { icon: AlertTriangle, color: 'var(--text-muted)' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([
    { label: "Today's Revenue", value: '—', icon: TrendingUp, color: "var(--text-muted)" },
    { label: 'Active Washes', value: '—', icon: Waves, color: "var(--text-muted)" },
    { label: 'Devices Online', value: '—', icon: Cpu, color: "var(--text-muted)" },
    { label: 'Active Alerts', value: '—', icon: AlertTriangle, color: "var(--text-muted)" },
  ]);

  const [supplies, setSupplies] = useState<SupplyItem[]>([
    { label: "Water Tank", level: null, color: "#00B4D8" },
    { label: "Soap Tank A", level: null, color: "#F6AD55" },
    { label: "Soap Tank B", level: null, color: "#00F5A0" },
  ]);

  const [flowRate, setFlowRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [bay, setBay] = useState<BayState>(defaultBay);
  const [bayName, setBayName] = useState('');
  const [sendingCommand, setSendingCommand] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await api.getDashboardStats();
        setStats(data.stats.map((s: StatCard) => ({
          ...s,
          icon: STAT_ICONS[s.label]?.icon ?? TrendingUp,
          color: STAT_ICONS[s.label]?.color ?? 'var(--text-muted)',
        })));
        setSupplies(data.supplies);
        setFlowRate(data.flow_rate);
        setTemperature(data.temperature);
      } catch {
        console.warn('Dashboard backend unavailable');
      }
    };
    const fetchDevices = async () => {
      try {
        const devices = await api.getDevices();
        const online = devices.filter((d: DeviceItem) => d.status === 'online').length;
        setStats(prev => prev.map(s =>
          s.label === 'Devices Online'
            ? { ...s, value: String(online), subValue: `/ ${devices.length}` }
            : s
        ));
        const bayDevice = devices.find((d: DeviceItem) => d.id === 'esp32_bay_1');
        if (bayDevice) {
          setBay(prev => ({ ...prev, online: bayDevice.status === 'online' }));
          setBayName(bayDevice.name || 'Main Wash Bay');
        }
      } catch {
        console.warn('Devices backend unavailable');
      }
    };
    fetchDashboard();
    fetchDevices();
    const interval = setInterval(() => { fetchDashboard(); fetchDevices(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Live bay telemetry over Socket.IO (every 3s from the bridge)
  useEffect(() => {
    socketService.connect();
    const unsub = socketService.onHardwareUpdate((msg) => {
      if (!msg?.topic) return;
      const parts = msg.topic.split('/');
      const category = parts[2];
      const deviceId = parts[3];

      if (deviceId !== 'esp32_bay_1') return;

      if (category === 'status') {
        const d = msg.data as Record<string, unknown>;
        const rawStatus = String(d.status ?? 'available');
        const status: BayState['status'] =
          rawStatus === 'error' ? 'error' : rawStatus === 'active' ? 'active' : 'available';
        setBay(prev => ({
          ...prev,
          online: true,
          hasStatus: true,
          status,
          progress: typeof d.progress === 'number' ? Math.min(100, Math.max(0, d.progress)) : prev.progress,
          currentCycle: typeof d.currentCycle === 'string' && d.currentCycle ? d.currentCycle : prev.currentCycle,
          cycleType: typeof d.type === 'string' && d.type ? d.type : prev.cycleType,
        }));
      } else if (category === 'sensor' && msg.topic.includes('/levels')) {
        const d = msg.data as Record<string, unknown>;
        setSupplies([
          { label: "Water Tank", level: d.water != null ? Number(d.water) : null, color: "#00B4D8" },
          { label: "Soap Tank A", level: d.soap_a != null ? Number(d.soap_a) : null, color: "#F6AD55" },
          { label: "Soap Tank B", level: d.soap_b != null ? Number(d.soap_b) : null, color: "#00F5A0" },
        ]);
      } else if (category === 'sensor' && msg.topic.includes('/flow_temp')) {
        const d = msg.data as Record<string, unknown>;
        setFlowRate(d.flow_lpm != null ? Number(d.flow_lpm) : null);
        setTemperature(d.temp_c != null ? Number(d.temp_c) : null);
      }
    });
    return () => unsub();
  }, []);

  const sendBayCommand = async (action: string) => {
    setSendingCommand(true);
    try {
      await api.sendCommand('esp32_bay_1', action);
    } catch {
      console.warn('Failed to send command');
    }
    setSendingCommand(false);
  };

  const statusLabel =
    !bay.hasStatus ? '—' :
    bay.status === 'active' ? 'Active' :
    bay.status === 'error' ? 'Jam Detected' : 'Available';
  const statusColor =
    bay.status === 'active' ? 'var(--success)' :
    bay.status === 'error' ? 'var(--danger)' : 'var(--text-muted)';

  const controlAction =
    bay.status === 'error' ? 'reset_jam' :
    bay.status === 'active' ? 'emergency_stop' : 'trigger_wash';
  const controlLabel =
    bay.status === 'error' ? 'Reset Jam' :
    bay.status === 'active' ? 'Stop Wash' : 'Start Wash';
  const ControlIcon =
    bay.status === 'error' ? RotateCcw :
    bay.status === 'active' ? Square : Play;

  return (
    <>
      <Header title="Dashboard" subtitle="Real-time facility overview" />
      
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto overflow-x-hidden animate-fade-in">
        
        {/* Tiered Grid for Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="card p-5 group hover:scale-[1.02]">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {stat.label}
                </p>
                <div 
                  className="p-2 rounded-xl transition-transform group-hover:rotate-12"
                  style={{ background: `${stat.color}20`, color: stat.color }}
                >
                  <stat.icon size={20} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl sm:text-3xl font-bold font-ui tracking-tight">{stat.value}</h3>
                {stat.subValue && <span className="text-sm font-medium text-[var(--text-muted)] font-mono">{stat.subValue}</span>}
              </div>
              {stat.change && (
                <p className="text-[10px] font-bold mt-2 flex items-center gap-1" style={{ color: stat.color }}>
                  <TrendingUp size={12} /> {stat.change}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Bay Control (Left 2 Columns on Desktop) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-base)]">
                <h3 className="font-bold font-display flex items-center gap-2">
                  <Waves size={18} className="text-[var(--accent)]" />
                  Main Wash Bay Status
                </h3>
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: bay.online ? 'var(--success)' : 'var(--text-muted)' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${bay.online ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
                  {bay.online ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <div className="p-6 sm:p-10 flex flex-col items-center text-center">
                <div 
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-8"
                  style={{
                    background: bay.status === 'active'
                      ? `conic-gradient(var(--accent) ${bay.progress * 3.6}deg, var(--bg-input) 0deg)`
                      : 'var(--bg-input)',
                    border: `4px solid ${bay.status === 'error' ? 'var(--danger)' : 'var(--border)'}`,
                    transition: 'all 0.5s ease',
                  }}
                >
                   <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center" style={{ border: '4px solid var(--border)' }}>
                     {bay.status === 'error' ? (
                       <AlertTriangle size={32} style={{ color: 'var(--danger)' }} />
                     ) : (
                       <Waves size={32} style={{ color: bay.status === 'active' ? 'var(--accent)' : 'var(--text-muted)' }} />
                     )}
                   </div>
                </div>
                
                <div className="space-y-2 mb-10">
                  <h4 className="text-3xl sm:text-4xl font-bold font-ui uppercase tracking-tight" style={{ color: bay.online ? 'var(--text-primary)' : 'var(--text-muted)' }}>{bayName || '—'}</h4>
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle size={16} style={{ color: statusColor }} />
                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-md">
                  <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Selected Cycle</p>
                    <p className="font-bold text-[var(--text-primary)]">{bay.currentCycle}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Wash Type</p>
                    <p className="font-bold text-[var(--text-primary)]">{bay.cycleType}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Progress</p>
                    <p className="font-bold font-mono" style={{ color: bay.status === 'active' ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {bay.status === 'active' ? `${Math.round(bay.progress)}%` : '—'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => sendBayCommand(controlAction)}
                  disabled={!bay.online || sendingCommand}
                  className="btn btn-primary w-full max-w-md mt-8 py-4 sm:py-5 flex items-center justify-center gap-3 text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={!bay.online ? { background: 'var(--border)', color: 'var(--text-muted)', boxShadow: 'none' } : undefined}
                >
                  <ControlIcon size={20} fill="currentColor" />
                  {sendingCommand ? 'SENDING...' : !bay.online ? 'SYSTEM OFFLINE' : controlLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Supply Levels (Right Column) */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="font-bold font-display flex items-center gap-2 mb-8">
                <Zap size={18} className="text-[var(--accent)]" />
                Supply Levels
              </h3>
              
              <div className="space-y-8">
                {supplies.map((supply, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                      <span className="text-[var(--text-secondary)]">{supply.label}</span>
                      <span className="text-[var(--text-muted)]">{supply.level === null ? '—' : `${supply.level}%`}</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--bg-input)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${supply.level === null ? 0 : supply.level}%`, backgroundColor: supply.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-[var(--border)] grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 font-mono tracking-widest opacity-70">Water Flow</p>
                  <p className="text-xl font-bold font-ui tracking-tight" style={{color: flowRate !== null && flowRate > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{flowRate === null ? '—' : `${flowRate.toFixed(1)}`} {flowRate !== null && <span className="text-xs font-medium">L/min</span>}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 font-mono tracking-widest opacity-70">Temperature</p>
                  <p className="text-xl font-bold font-ui tracking-tight" style={{color: temperature !== null && temperature > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{temperature === null ? '—' : `${temperature.toFixed(1)}`} {temperature !== null && <span className="text-xs font-medium">°C</span>}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </>
  );
}