"use client";

import Header from '@/components/Header';
import {
  History,
  User,
  Settings,
  TerminalSquare,
  LogIn,
  LogOut,
  ShieldAlert,
  Coins,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AuditItem {
  id: number;
  user: string;
  ip: string | null;
  action: string;
  details: string;
  time: string;
}

const ACTION_FILTERS = [
  { value: 'ALL', label: 'All events' },
  { value: 'LOGIN', label: 'Sign in' },
  { value: 'LOGOUT', label: 'Sign out' },
  { value: 'FAILED_LOGIN', label: 'Failed sign-in' },
  { value: 'DEVICE_COMMAND', label: 'Machine commands' },
  { value: 'DEVICE_ONLINE', label: 'Device came online' },
  { value: 'DEVICE_OFFLINE', label: 'Device went offline' },
  { value: 'COIN_ACCEPTED', label: 'Coins accepted' },
  { value: 'WASH_COMPLETED', label: 'Wash cycles finished' },
  { value: 'ALERT_TRIGGERED', label: 'Alerts triggered' },
  { value: 'ALERT_RESOLVED', label: 'Alerts cleared' },
  { value: 'RESOLVE_ALERT', label: 'Alerts marked resolved' },
  { value: 'VENDO_CONFIG', label: 'Vending machine settings' },
  { value: 'UPDATE_PROFILE', label: 'Profile updates' },
  { value: 'UPDATE_PREFERENCES', label: 'Preference changes' },
] as const;

type ActionType = (typeof ACTION_FILTERS)[number]['value'];

const ACTION_META: Record<string, { icon: React.ReactNode; color: string; type: string }> = {
  LOGIN: { icon: <LogIn size={13} />, color: '#34D399', type: 'user' },
  LOGOUT: { icon: <LogOut size={13} />, color: '#94A3B8', type: 'user' },
  FAILED_LOGIN: { icon: <ShieldAlert size={13} />, color: '#F87171', type: 'security' },
  DEVICE_COMMAND: { icon: <TerminalSquare size={13} />, color: '#38BDF8', type: 'command' },
  DEVICE_ONLINE: { icon: <Droplets size={13} />, color: '#2DD4BF', type: 'device' },
  DEVICE_OFFLINE: { icon: <Droplets size={13} />, color: '#64748B', type: 'device' },
  COIN_ACCEPTED: { icon: <Coins size={13} />, color: '#FBBF24', type: 'vending' },
  WASH_COMPLETED: { icon: <Droplets size={13} />, color: '#22D3EE', type: 'vending' },
  ALERT_TRIGGERED: { icon: <AlertTriangle size={13} />, color: '#F87171', type: 'system' },
  ALERT_RESOLVED: { icon: <CheckCircle2 size={13} />, color: '#34D399', type: 'system' },
  RESOLVE_ALERT: { icon: <CheckCircle2 size={13} />, color: '#34D399', type: 'system' },
  VENDO_CONFIG: { icon: <Settings size={13} />, color: '#C084FC', type: 'settings' },
  UPDATE_PROFILE: { icon: <User size={13} />, color: '#60A5FA', type: 'user' },
  UPDATE_PREFERENCES: { icon: <Settings size={13} />, color: '#60A5FA', type: 'settings' },
};

const getMeta = (action: string) =>
  ACTION_META[action] || { icon: <History size={13} />, color: 'var(--text-muted)', type: 'system' };

const getActionLabel = (action: string) =>
  ACTION_FILTERS.find((a) => a.value === action)?.label || action.replace(/_/g, ' ').toLowerCase();

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<ActionType>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (action = filter, query = search, pageNum = page) => {
    setRefreshing(true);
    try {
      const params: Record<string, string> = { page: String(pageNum), limit: '10' };
      if (action !== 'ALL') params.action = action;
      if (query.trim()) params.search = query.trim();
      const data = await api.getAuditLogs(params);
      setAuditLogs(data.data || []);
      setPage(data.pagination?.current_page ?? pageNum);
      setTotalPages(data.pagination?.total_pages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      console.warn('Audit backend unavailable');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
    const interval = setInterval(() => fetchLogs(), 3000);
    const onFocus = () => fetchLogs();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (value: ActionType) => {
    setFilter(value);
    fetchLogs(value, search, 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchLogs(filter, searchInput, 1);
  };

  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    fetchLogs(filter, search, pageNum);
  };

  const counts = auditLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Header title="Audit Log" subtitle="Complete, real-time record of system events and administrative actions" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto overflow-x-hidden">
        {/* Filter bar */}
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Action filter dropdown */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] shrink-0">Filter</span>
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => handleFilterChange(e.target.value as ActionType)}
                  className="h-9 pl-3 pr-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-semibold outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer max-w-full"
                >
                  {ACTION_FILTERS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-60" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search user, action, IP…"
                  className="h-9 pl-9 pr-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs outline-none focus:border-[var(--accent)] transition-colors w-52"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5"
                style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearch(''); fetchLogs(filter, ''); }}
                title="Refresh"
                className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </form>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] self-center mr-1">
              {auditLogs.length} events
            </span>
            {Object.entries(counts)
              .slice(0, 6)
              .map(([action, n]) => (
                <span key={action} className="px-2 py-0.5 rounded-md border border-[var(--border)] text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: getMeta(action).color }}>
                  {getMeta(action).icon} {getActionLabel(action)} × {n}
                </span>
              ))}
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold font-display text-sm sm:text-base flex items-center gap-2">
              <History size={18} style={{ color: 'var(--accent)' }}/>
              System Activity
            </h3>
          </div>

          {/* Mobile Card View (Hidden on Tablet/Desktop) */}
          <div className="md:hidden space-y-4">
            {auditLogs.map((log) => {
              const meta = getMeta(log.action);
              return (
                <div key={log.id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center gap-3">
                    <span className="font-mono text-[10px] text-[var(--text-muted)] font-bold">{log.time}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: meta.color }}>
                      {meta.icon} {meta.type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight mb-2" style={{ color: getMeta(log.action).color, fontFamily: 'var(--font-display)' }}>
                      {getActionLabel(log.action)}
                    </p>
                    <p className="text-xs leading-6 opacity-80">{log.details}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--divider)]">
                    <div className="flex items-center gap-2">
                      <User size={12} className="opacity-40" />
                      <span className="text-[10px] font-bold font-mono text-[var(--accent)]">{log.user}</span>
                    </div>
                    {log.ip && <span className="text-[9px] font-mono text-[var(--text-muted)]">{log.ip}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablet/Desktop Table View (Hidden on Mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] lg:text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="pb-5 font-normal w-[170px]">TIMESTAMP</th>
                  <th className="pb-5 font-normal w-[190px]">USER / ORIGIN</th>
                  <th className="pb-5 font-normal w-[220px]">ACTION</th>
                  <th className="pb-5 font-normal">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {auditLogs.map((log) => {
                  const meta = getMeta(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-5 pr-4 text-[var(--text-secondary)] font-mono whitespace-nowrap text-xs lg:text-sm">{log.time}</td>
                      <td className="py-5 pr-4 whitespace-nowrap text-xs lg:text-sm">
                        <div className="font-bold">{log.user}</div>
                        {log.ip && <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{log.ip}</div>}
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap text-xs lg:text-sm">
                        <span className="flex items-center gap-2.5">
                          <span style={{ color: meta.color }}>{meta.icon}</span>
                          <span className="font-bold uppercase tracking-wide text-[11px]" style={{ color: meta.color }}>{getActionLabel(log.action)}</span>
                        </span>
                      </td>
                      <td className="py-5 pr-6 text-[var(--text-secondary)] min-w-[300px] leading-6 text-xs lg:text-sm">{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-[var(--border)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
              Showing {auditLogs.length} of {total} events
            </span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="h-9 px-4 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-elevated)] transition-all hover:opacity-80 disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="h-9 px-4 rounded-lg text-[11px] font-bold font-mono flex items-center justify-center border border-[var(--border)] bg-[var(--bg-elevated)] min-w-[92px]">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="h-9 px-4 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-elevated)] transition-all hover:opacity-80 disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}