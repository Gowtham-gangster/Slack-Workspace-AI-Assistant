'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ActiveTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ActiveTheme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('dark');

  const applyTheme = useCallback((computedTheme: ActiveTheme) => {
    const root = document.documentElement;
    if (computedTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    }
    setActiveTheme(computedTheme);
  }, []);

  useEffect(() => {
    const savedMode = (localStorage.getItem('app-theme-mode') as ThemeMode) || 'dark';
    setThemeModeState(savedMode);

    if (savedMode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemPrefersDark ? 'dark' : 'light');
    } else {
      applyTheme(savedMode === 'light' ? 'light' : 'dark');
    }
  }, [applyTheme]);

  // Listen for system theme changes if set to 'system'
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (themeMode === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode, applyTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('app-theme-mode', mode);
    if (mode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemPrefersDark ? 'dark' : 'light');
    } else {
      applyTheme(mode);
    }
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: ActiveTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
  }, [activeTheme, setThemeMode]);

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, themeMode, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

