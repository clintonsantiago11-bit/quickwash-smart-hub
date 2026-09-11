'use client';

import Link from 'next/link';
import { Bell, Search, User, Menu, Sun, Moon, LogOut, Settings as SettingsIcon, AlertTriangle, Zap, Info, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUI } from '@/providers/UIProvider';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface NotificationItem {
  id: number;
  device: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  time: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<{ full_name: string; email: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toggleMobileMenu, isDarkMode, toggleTheme } = useUI();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    socketService.connect();
    const unsub = socketService.onConnectionChange(setIsConnected);
    return () => unsub();
  }, []);

  useEffect(() => {
    api.getProfile().then((user) => {
      setUserInfo({ full_name: user.full_name, email: user.email });
    }).catch(() => {
      setUserInfo({ full_name: 'Admin User', email: 'admin@quickwash.hub' });
    });
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await api.getAlerts();
      const active = data.filter((a: NotificationItem) => a.status === 'active');
      setNotifications(active.slice(0, 5));
      setUnreadCount(active.length);
    } catch {
      // backend unavailable - keep last known state
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    // Refresh instantly when the bridge reports a new alert topic
    const unsub = socketService.onHardwareUpdate((msg) => {
      if (msg?.topic && msg.topic.includes('/alert/')) {
        fetchNotifications();
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setActiveDropdown(null);
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);
    try {
      await api.logout();
    } catch {}
    setTimeout(() => router.push('/login'), 1000);
  };

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <>
    <header
      className="h-[72px] flex items-center justify-between px-3 md:px-6 shrink-0 sticky top-0 z-30 transition-all duration-300"
      style={{
        background: 'var(--bg-elevated)',
        opacity: 0.95,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left Section: Menu & Brand */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 md:flex-initial">
        <button 
          onClick={toggleMobileMenu}
          className="md:hidden text-[var(--text-primary)] p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors shrink-0"
        >
          <Menu size={22} />
        </button>
        
        {/* Responsive Brand Area */}
        <div className="min-w-0 flex-1">
          <h2
            className="font-bold truncate leading-tight uppercase font-ui tracking-tight"
            style={{ 
              color: 'var(--text-primary)',
              fontSize: 'clamp(14px, 4vw, 18px)',
              maxWidth: '50vw'
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="hidden md:block text-[10px] lg:text-xs mt-0.5 truncate opacity-50 font-mono" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center Section: Fluid Search Bar */}
      <div className="hidden md:flex flex-1 justify-center px-4 md:px-8">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full bg-[var(--bg-input)] text-sm rounded-xl pl-10 pr-4 py-2 border border-[var(--border)] outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all placeholder:opacity-50" 
          />
        </div>
      </div>

      {/* Right Section: Global Actions */}
      <div className="flex items-center justify-end gap-1 sm:gap-3 shrink-0">
        {/* Connection Status Badge */}
        <div
          className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: isConnected ? 'var(--success-muted)' : 'var(--danger-muted)',
            color: isConnected ? 'var(--success)' : 'var(--danger)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isConnected ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
          {isConnected ? 'MQTT Online' : 'Offline'}
        </div>

        {/* Search Trigger (Mobile) */}
        <div className="md:hidden relative">
          <button
            onClick={() => toggleDropdown('search')}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${activeDropdown === 'search' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
          >
            <Search size={20} />
          </button>
          {activeDropdown === 'search' && (
            <div className="fixed inset-x-0 top-[72px] p-3 animate-slide-up z-50 md:hidden" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                <input autoFocus type="text" placeholder="Search..." className="w-full bg-[var(--bg-input)] text-sm rounded-lg pl-9 pr-3 py-2 outline-none border border-[var(--border)]" />
              </div>
            </div>
          )}
        </div>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('notifications')}
            className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] ${activeDropdown === 'notifications' ? 'text-[var(--accent)] bg-[var(--bg-hover)]' : 'text-[var(--text-muted)]'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-elevated)]" />
            )}
          </button>
          
          {activeDropdown === 'notifications' && (
            <div 
              className="fixed inset-x-3 top-[72px] md:absolute md:inset-auto md:right-0 md:top-12 md:w-80 rounded-2xl shadow-2xl border overflow-hidden animate-slide-up z-50 font-ui"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
            >
              <div className="p-4 border-b flex justify-between items-center bg-[var(--bg-base)]" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Notifications</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400">{unreadCount} NEW</span>
              </div>
              
              <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle size={24} className="mx-auto mb-2 text-[var(--success)]" />
                    <p className="text-xs font-bold text-[var(--text-secondary)]">All clear - no active alerts</p>
                  </div>
                ) : notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { setActiveDropdown(null); router.push('/alerts'); }}
                    className="p-3 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
                  >
                    <div className="flex gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: n.severity === 'critical' ? 'var(--danger-muted)' : n.severity === 'warning' ? 'var(--warning-muted)' : 'var(--info-muted)',
                        }}
                      >
                        {n.severity === 'critical' ? (
                          <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                        ) : n.severity === 'warning' ? (
                          <Zap size={14} style={{ color: 'var(--warning)' }} />
                        ) : (
                          <Info size={14} style={{ color: 'var(--info)' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{n.type.replace('_', ' ')}</p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">{n.message || `Reported by ${n.device}`}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-[var(--bg-base)] text-center">
                <Link href="/alerts" onClick={() => setActiveDropdown(null)} className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] hover:underline">
                  View All Alerts
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle (Tablet/Desktop) */}
        <button
          onClick={toggleTheme}
          className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)' }}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile / Account Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('user')}
            className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-transparent hover:border-[var(--accent)] transition-all overflow-hidden"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <User size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
          {activeDropdown === 'user' && (
            <div className="absolute right-0 top-12 w-56 rounded-xl shadow-2xl border overflow-hidden animate-slide-up z-50" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <div className="p-4 border-b bg-[var(--bg-base)]" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-bold truncate">{userInfo?.full_name || 'Admin User'}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{userInfo?.email || 'admin@quickwash.hub'}</p>
              </div>
              <div className="p-2 space-y-1">
                {/* Mobile-Only Options */}
                <div className="md:hidden">
                  <button 
                    onClick={() => { toggleTheme(); setActiveDropdown(null); }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                      {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                      <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative ${isDarkMode ? 'bg-[var(--accent)]' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isDarkMode ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <div className="h-[1px] my-1" style={{ background: 'var(--border)' }} />
                </div>

                <Link 
                  href="/profile"
                  onClick={() => setActiveDropdown(null)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-hover)] flex items-center gap-2 text-[var(--text-secondary)]"
                >
                  <User size={14}/> Profile
                </Link>
                <Link 
                  href="/preferences"
                  onClick={() => setActiveDropdown(null)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-hover)] flex items-center gap-2 text-[var(--text-secondary)]"
                >
                  <SettingsIcon size={14}/> Preferences
                </Link>
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--danger-muted)] text-[var(--danger)] flex items-center gap-2 mt-1">
                  <LogOut size={14}/> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Logout Confirmation Modal */}
    {showLogoutConfirm && (
      <div
        className="qw-fade-in fixed inset-0 z-[120] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={() => setShowLogoutConfirm(false)}
      >
        <div
          className="qw-pop-in w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--danger-muted)' }}>
            <LogOut size={28} style={{ color: 'var(--danger)' }} />
          </div>
          <h3 className="text-lg font-black uppercase tracking-wider text-[var(--text-primary)]">Sign Out?</h3>
          <p className="text-xs mt-2 leading-relaxed text-[var(--text-secondary)]">
            You will be signed out of the QuickWash Smart Hub and returned to the login screen.
          </p>
          <div className="flex gap-3 mt-7">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 hover:bg-[var(--bg-hover)] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLogout}
              className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:brightness-110"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Signing Out Animation Overlay */}
    {isLoggingOut && (
      <div className="qw-fade-in fixed inset-0 z-[130] flex items-center justify-center" style={{ background: 'rgba(3,7,18,0.94)', backdropFilter: 'blur(10px)' }}>
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-full border-4 border-white/10 border-t-[var(--accent)] animate-spin" />
          <p className="text-sm font-black uppercase tracking-[0.35em] text-white/85">Signing Out</p>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/40 mt-2">See you at the next wash</p>
        </div>
      </div>
    )}

    <style jsx>{`
      @keyframes qwFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .qw-fade-in {
        animation: qwFadeIn 0.25s ease-out both;
      }
      @keyframes qwPopIn {
        0% { opacity: 0; transform: scale(0.85) translateY(14px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      .qw-pop-in {
        animation: qwPopIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
    `}</style>
    </>
  );
}
