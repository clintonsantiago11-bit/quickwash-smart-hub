"use client";

import Header from '@/components/Header';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AlertItem {
  id: number;
  device: string;
  type: string;
  severity: string;
  message: string;
  status: 'active' | 'resolved';
  time: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await api.getAlerts();
        setAlerts(data);
        setActiveCount(data.filter((a: AlertItem) => a.status === 'active').length);
        setResolvedCount(data.filter((a: AlertItem) => a.status === 'resolved').length);
      } catch {
        console.warn('Alerts backend unavailable');
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id: number) => {
    try {
      await api.resolveAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
      setActiveCount(prev => Math.max(0, prev - 1));
      setResolvedCount(prev => prev + 1);
    } catch {}
  };
  return (
    <>
      <Header title="Alert Management" subtitle="System warnings and hardware logs" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        
        {/* Alert KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex items-center justify-center shrink-0">
              <AlertTriangle className={activeCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'} size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Active Issues</p>
              <h3 className="text-xl font-bold font-ui" style={{color: activeCount > 0 ? 'var(--danger)' : 'var(--text-muted)'}}>{activeCount} Active</h3>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex items-center justify-center shrink-0">
              <CheckCircle className={resolvedCount > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Resolved Today</p>
              <h3 className="text-xl font-bold font-ui" style={{color: resolvedCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{resolvedCount} Incidents</h3>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold font-ui text-sm sm:text-base uppercase tracking-wider opacity-70">Recent Incidents</h3>
          </div>
          <div className="space-y-4 lg:space-y-6">
            {alerts.map(alert => (
              <div key={alert.id} className="p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-start gap-4 transition-all hover:shadow-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="shrink-0">
                  {alert.severity === 'critical' ? <AlertTriangle size={22} style={{ color: 'var(--danger)' }} /> : 
                   alert.severity === 'warning' ? <AlertTriangle size={22} style={{ color: 'var(--warning)' }} /> : 
                   <Info size={22} style={{ color: 'var(--info)' }} />}
                </div>
                 
                <div className="flex-1 min-w-0 w-full space-y-1">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <h4 className="font-bold text-sm lg:text-base tracking-tight uppercase font-ui" style={{ color: 'var(--text-primary)' }}>
                      {alert.type.replace('_', ' ')}
                    </h4>
                    <span className="inline-flex items-center text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] font-mono">
                      {alert.time}
                    </span>
                  </div>
                  <p className="text-xs lg:text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-[10px] lg:text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      NODE: {alert.device}
                    </span>
                  </div>
                </div>

                <div className="w-full sm:w-auto mt-4 sm:mt-0 shrink-0 flex justify-end items-center">
                  {alert.status === 'resolved' ? (
                    <span className="badge badge-online">
                      <CheckCircle size={12} className="mr-2"/> Resolved
                    </span>
                  ) : (
                    <button onClick={() => handleResolve(alert.id)} className="btn btn-ghost w-full sm:w-auto py-2 px-5 text-[10px] lg:text-xs font-bold uppercase tracking-widest border-2 border-[var(--border)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-black transition-all font-ui">
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
