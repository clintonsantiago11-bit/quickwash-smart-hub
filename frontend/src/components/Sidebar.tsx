'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Cpu,
  Camera,
  BarChart3,
  Coins,
  Bell,
  Settings,
  Droplets,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { useUI } from '@/providers/UIProvider';

const navItems = [
  { label: 'Dashboard',  href: '/',           icon: LayoutDashboard },
  { label: 'Devices',    href: '/devices',     icon: Cpu },
  { label: 'Cameras',    href: '/cameras',     icon: Camera },
  { label: 'Analytics',  href: '/analytics',   icon: BarChart3 },
  { label: 'Vending',    href: '/vending',     icon: Coins },
  { label: 'Vendo Config', href: '/vendo',     icon: SlidersHorizontal },
  { label: 'Alerts',     href: '/alerts',      icon: Bell },
  { label: 'Audit Log',  href: '/audit',       icon: History },
  { label: 'Settings',   href: '/settings',    icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isMobileMenuOpen, closeMobileMenu, isSidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = useUI();

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col
          transition-all duration-300 ease-out
          ${collapsed ? 'md:w-[72px] w-[260px]' : 'w-[260px]'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border)',
        }}
      >
      {/* Logo Area */}
      <div
        className="flex items-center gap-3 px-5 h-[72px] shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <Droplets size={18} className="text-[var(--bg-base)]" strokeWidth={2.5} />
        </div>
        {(!collapsed || isMobileMenuOpen) && (
          <div className="animate-fade-in flex-1 min-w-0">
            <div
              className="font-black tracking-normal leading-none"
              style={{ fontSize: '14px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Quick<span className="font-light text-[var(--accent)] ml-0.5">Wash</span>
            </div>
            <p
              className="text-[8px] font-bold tracking-[0.2em] uppercase mt-0.5 opacity-50"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
            >
              Smart Hub
            </p>
          </div>
        )}
        {/* Mobile close button */}
        {isMobileMenuOpen && (
          <button onClick={closeMobileMenu} className="md:hidden text-[var(--text-muted)] p-1">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200 relative
                ${collapsed ? 'justify-center' : ''}
              `}
              style={{
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              }}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
              {(!collapsed || isMobileMenuOpen) && (
                <span
                  className="text-[13px] font-medium whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    color: isActive ? 'var(--accent)' : undefined,
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (Desktop only) */}
      <div
        className="px-3 py-4 shrink-0 hidden md:block"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors duration-200"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && (
            <span className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
    </>
  );
}
