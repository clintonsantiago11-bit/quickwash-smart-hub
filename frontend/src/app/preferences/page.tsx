"use client";

import Header from '@/components/Header';
import { 
  Settings as SettingsIcon, ShieldCheck, Key, 
  ChevronRight, Save, Clock, CheckCircle2, Bell, Mail
} from 'lucide-react';
import { useUI } from '@/providers/UIProvider';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function PreferencesPage() {
  const { isDarkMode, toggleTheme } = useUI();
  const [profile, setProfile] = useState({
    is_dark_mode: true,
    email_alerts: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(prev => ({ ...prev, is_dark_mode: isDarkMode }));
  }, [isDarkMode]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.getProfile();
        setProfile(prev => ({ ...prev, ...data }));
      } catch {
        console.warn('Using local defaults (backend unavailable)');
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updatePreferences(profile);
      setTimeout(() => {
        setIsSaving(false);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      }, 800);
    } catch {
      setIsSaving(false);
      alert('Failed to save preferences');
    }
  };

  return (
    <>
      <Header title="Preferences" subtitle="Customize your platform experience" />
      
      <main className="flex-1 p-3 sm:p-4 md:p-6 w-full max-w-5xl mx-auto overflow-x-hidden pb-24 sm:pb-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card p-6 bg-gradient-to-br from-[var(--accent-glow)] to-transparent border-[var(--accent)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mb-4 text-black shadow-lg">
                <SettingsIcon size={24} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest mb-2">User Settings</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Configure how the application behaves for your account. These settings are synchronized across all your devices.
              </p>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary w-full mt-6 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Apply Changes'}
              </button>
            </div>

            <div className="card p-6 border-dashed">
              <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-mono">Quick Help</h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-muted)]">Dark mode helps reduce eye strain in low-light environments.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-muted)]">Email alerts ensure you never miss critical hardware failures.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            
            <section className="card p-6 lg:p-8 animate-fade-in">
              <h3 className="text-sm font-bold mb-8 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest border-b border-[var(--border)] pb-4">
                <SettingsIcon size={18} className="text-[var(--accent)]"/>
                Interface & Alerts
              </h3>
              
              <div className="space-y-4">
                <div className="group flex items-center justify-between p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                      <Bell size={20} className="text-[var(--accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Dark Mode</p>
                      <p className="text-xs text-[var(--text-muted)]">Use the deep charcoal and accent theme.</p>
                    </div>
                  </div>
                  <div 
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${isDarkMode ? 'bg-[var(--accent)]' : 'bg-gray-400'}`}
                    onClick={toggleTheme}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : ''}`} />
                  </div>
                </div>

                <div className="group flex items-center justify-between p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                      <Mail size={20} className="text-[var(--accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Email Notifications</p>
                      <p className="text-xs text-[var(--text-muted)]">Receive weekly hardware health reports.</p>
                    </div>
                  </div>
                  <div 
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${profile.email_alerts ? 'bg-[var(--accent)]' : 'bg-gray-600'}`}
                    onClick={() => setProfile({...profile, email_alerts: !profile.email_alerts})}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${profile.email_alerts ? 'translate-x-6' : ''}`} />
                  </div>
                </div>
              </div>
            </section>

            <section className="card p-6 lg:p-8 animate-fade-in">
              <h3 className="text-sm font-bold mb-8 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest border-b border-[var(--border)] pb-4">
                <ShieldCheck size={18} className="text-[var(--accent)]"/>
                Security Layer
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                      <ShieldCheck size={20} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Two-Factor Auth</p>
                      <p className="text-xs text-[var(--text-muted)]">Currently disabled. Recommended for admins.</p>
                    </div>
                  </div>
                  <button className="btn btn-outline py-2 px-6 text-[10px] font-black uppercase tracking-widest w-full sm:w-auto">Configure</button>
                </div>

                <button className="w-full flex items-center justify-between p-5 rounded-2xl bg-[var(--bg-hover)] border border-transparent hover:border-[var(--accent)] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-base)] flex items-center justify-center">
                      <Key size={20} className="text-[var(--accent)]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold">Update Password</p>
                      <p className="text-xs text-[var(--text-muted)]">Change your account security credentials.</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[var(--text-muted)]" />
                </button>
              </div>
            </section>

          </div>
        </div>

        {/* Success Toast */}
        {showSavedToast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--accent)] shadow-2xl flex flex-col items-center animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mb-4">
                <CheckCircle2 className="text-[var(--accent)]" size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest">Saved Successfully</h2>
              <p className="text-sm text-[var(--text-muted)]">Your account preferences are now live.</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
