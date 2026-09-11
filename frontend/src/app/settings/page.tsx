"use client";

import Header from '@/components/Header';
import { Settings as SettingsIcon, Save, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ProfileUser {
  full_name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const [brokerUrl, setBrokerUrl] = useState('mqtt://broker.hivemq.com');
  const [brokerPort, setBrokerPort] = useState('1883');
  const [lowWater, setLowWater] = useState('20');
  const [lowSoap, setLowSoap] = useState('15');
  const [adminUser, setAdminUser] = useState<ProfileUser | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('qw_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBrokerUrl(parsed.brokerUrl ?? 'mqtt://broker.hivemq.com');
        setBrokerPort(parsed.brokerPort ?? '1883');
        setLowWater(parsed.lowWater ?? '20');
        setLowSoap(parsed.lowSoap ?? '15');
      } catch {}
    }
    api.getProfile().then((user) => {
      setAdminUser({ full_name: user.full_name, email: user.email, role: user.role });
    }).catch(() => {});
  }, []);

  const handleSave = () => {
    localStorage.setItem('qw_settings', JSON.stringify({ brokerUrl, brokerPort, lowWater, lowSoap }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      <Header title="System Settings" subtitle="Configure platform parameters" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 w-full max-w-4xl mx-auto overflow-x-hidden">
        <div className="card p-4 sm:p-8 space-y-8 sm:space-y-12">
          
          <section>
            <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
              <SettingsIcon size={18} className="text-[var(--accent)]"/>
              MQTT Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>BROKER URL</label>
                <input type="text" value={brokerUrl} onChange={(e) => setBrokerUrl(e.target.value)} className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>PORT</label>
                <input type="text" value={brokerPort} onChange={(e) => setBrokerPort(e.target.value)} className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
              <SettingsIcon size={18} className="text-[var(--accent)]"/>
              Hardware Thresholds
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>LOW WATER ALERT (%)</label>
                <input type="number" value={lowWater} onChange={(e) => setLowWater(e.target.value)} className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>LOW SOAP ALERT (%)</label>
                <input type="number" value={lowSoap} onChange={(e) => setLowSoap(e.target.value)} className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
              <SettingsIcon size={18} className="text-[var(--accent)]"/>
              Administrators
            </h3>
            
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              <div className="min-w-[600px] sm:min-w-full">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-surface)] border-b border-[var(--border)]">
                    <tr>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>NAME</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>EMAIL</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ROLE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="p-4 font-bold text-[var(--text-primary)]">{adminUser?.full_name ?? 'System Administrator'}</td>
                      <td className="p-4 text-[var(--text-muted)] font-mono text-xs">{adminUser?.email ?? 'admin@quickwash.hub'}</td>
                      <td className="p-4">
                        <span className="badge badge-online px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                          {adminUser?.role ?? 'admin'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row gap-4 items-center">
            <button onClick={handleSave} className="btn btn-primary w-full sm:w-auto px-10 py-4 font-black uppercase tracking-widest text-black flex items-center justify-center gap-2 text-sm shadow-xl hover:shadow-[var(--accent-glow)] transition-all">
              {saved ? <CheckCircle size={18} /> : <Save size={18} />} {saved ? 'Saved' : 'Save All Changes'}
            </button>
            {saved && (
              <p className="text-xs font-bold text-[var(--success)]">Settings saved to this browser</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}