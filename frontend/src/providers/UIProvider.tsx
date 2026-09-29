"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface UIContextType {
  isDarkMode: boolean;
  /** Sets the theme explicitly, e.g. from the profile preference. */
  setTheme: (dark: boolean) => void;
  toggleTheme: () => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  // localStorage is the synchronous mirror so the very first paint already
  // has the right theme. The server copy (users.is_dark_mode) is the
  // durable one and is reconciled by the profile page once it loads.
  localStorage.setItem("theme", dark ? "dark" : "light");
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Follow the OS preference when nothing has been chosen yet. The previous
    // expression also tested `!savedTheme && !prefersDark`, which made the
    // result true either way and pinned the app to dark regardless.
    const dark = saved === null ? prefersDark : saved === "dark";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDarkMode(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const setTheme = useCallback((dark: boolean) => {
    setIsDarkMode(dark);
    applyTheme(dark);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      applyTheme(!prev);
      return !prev;
    });
  }, []);

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((v) => !v), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  return (
    <UIContext.Provider
      value={{
        isDarkMode,
        setTheme,
        toggleTheme,
        isMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        isSidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
