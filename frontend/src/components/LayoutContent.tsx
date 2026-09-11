'use client';

import React from 'react';
import Sidebar from "@/components/Sidebar";
import { useUI } from "@/providers/UIProvider";
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useUI();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const isAuth = localStorage.getItem('isAuthenticated');
    const token = localStorage.getItem('auth_token');
    if (!isAuth && !token && pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div 
        className="flex-1 flex flex-col min-w-0 relative transition-all duration-300 ease-out overflow-y-auto"
        style={{ 
          marginLeft: mounted && typeof window !== 'undefined' && window.innerWidth >= 768 
            ? (isSidebarCollapsed ? '72px' : '260px') 
            : '0px'
        }}
      >
        {children}
      </div>
    </div>
  );
}
