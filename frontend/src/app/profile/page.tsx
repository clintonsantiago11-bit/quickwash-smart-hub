"use client";

import Header from '@/components/Header';
import { 
  User, ShieldCheck, Clock, Camera, Mail, 
  Phone, Briefcase, Save, Key, CheckCircle2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    full_name: 'System Administrator',
    email: 'admin@quickwash.hub',
    phone: '+63 912 345 6789',
    designation: 'Main Facility Manager',
    username: 'admin',
    role: 'Administrator'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.getProfile();
        setProfile(prev => ({ ...prev, ...data }));
      } catch {
        console.warn('Using local profile (backend unavailable)');
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile(profile);
      setTimeout(() => {
        setIsSaving(false);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      }, 800);
    } catch {
      setIsSaving(false);
      alert('Failed to save profile');
    }
  };

  const activityFeed = [
    { title: 'Security Alert', desc: 'Login from new device detected', time: '2h ago', icon: ShieldCheck, color: 'text-orange-500' },
    { title: 'Profile Updated', desc: 'Phone number changed successfully', time: '5h ago', icon: CheckCircle2, color: 'text-[var(--accent)]' },
    { title: 'System Login', desc: 'Session started at Main Terminal', time: 'Yesterday', icon: Key, color: 'text-blue-500' }
  ];

  return (
    <>
      <Header title="User Profile" subtitle="Manage your personal identity" />
      
      <main className="flex-1 p-3 sm:p-4 md:p-6 w-full max-w-7xl mx-auto overflow-x-hidden pb-24 sm:pb-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <section className="card p-8 flex flex-col items-center text-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-full bg-[var(--bg-hover)] border-2 border-[var(--accent)] p-1 overflow-hidden">
                  <div className="w-full h-full rounded-full bg-[var(--accent-glow)] flex items-center justify-center">
                    <User size={64} className="text-[var(--accent)]" />
                  </div>
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-[var(--accent)] text-[var(--bg-base)] rounded-full shadow-lg hover:scale-110 transition-transform">
                  <Camera size={18} />
                </button>
              </div>
              <h2 className="text-xl font-black font-display text-[var(--text-primary)]">{profile.full_name}</h2>
              <p className="text-sm text-[var(--text-muted)] font-medium mb-6">{profile.email}</p>
              <div className="flex gap-2 w-full">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn btn-primary flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </section>

            <div className="card p-6">
              <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 font-mono">System Role</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Access Level</span>
                  <span className="badge badge-online">{profile.role || 'Admin'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Internal ID</span>
                  <span className="text-xs font-mono">#ADMIN-01</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Details */}
          <div className="lg:col-span-8 space-y-6">
            <section className="card p-6 lg:p-10 animate-fade-in">
              <h3 className="text-base font-bold mb-8 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
                <User size={18} className="text-[var(--accent)]"/>
                Account Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Full Name</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={profile.full_name || ""}
                      onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                      className="w-full bg-[var(--bg-input)] p-4 pl-14 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" 
                    />
                    <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Email Address</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={profile.email || ""}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      className="w-full bg-[var(--bg-input)] p-4 pl-14 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" 
                    />
                    <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Phone Number</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      className="w-full bg-[var(--bg-input)] p-4 pl-14 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" 
                    />
                    <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Designation</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={profile.designation || ""}
                      onChange={(e) => setProfile({...profile, designation: e.target.value})}
                      className="w-full bg-[var(--bg-input)] p-4 pl-14 rounded-xl text-sm border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all" 
                    />
                    <Briefcase size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                </div>
              </div>
            </section>

            <section className="card p-6 lg:p-10">
              <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6 font-mono">Recent Log History</h4>
              <div className="space-y-4">
                {activityFeed.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center">
                        <item.icon size={16} className={item.color} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">{item.title}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{item.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Global Save Success Overlay */}
        {showSavedToast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--accent)] shadow-2xl flex flex-col items-center animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mb-4">
                <CheckCircle2 className="text-[var(--accent)]" size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-widest">Profile Saved</h2>
              <p className="text-sm text-[var(--text-muted)]">Your changes are now live across the hub.</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
