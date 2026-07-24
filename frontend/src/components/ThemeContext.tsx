'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';

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
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    localStorage.setItem('app-theme-mode', 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    // Permanent dark mode
  }, []);

  const setThemeMode = useCallback(() => {
    // Permanent dark mode
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark', themeMode: 'dark', toggleTheme, setThemeMode }}>
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
