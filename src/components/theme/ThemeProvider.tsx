'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';
export type AccentMode = 'teal' | 'violet' | 'amber';

interface ThemeContextValue {
  theme: ThemeMode;
  accent: AccentMode;
  setTheme: (next: ThemeMode) => void;
  setAccent: (next: AccentMode) => void;
}

const THEME_STORAGE_KEY = 'gms:theme';
const ACCENT_STORAGE_KEY = 'gms:accent';

const DEFAULT_THEME: ThemeMode = 'dark';
const DEFAULT_ACCENT: AccentMode = 'teal';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME;
}

function getStoredAccent(): AccentMode {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCENT;
  }

  const value = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return value === 'teal' || value === 'violet' || value === 'amber' ? value : DEFAULT_ACCENT;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accent, setAccent] = useState<AccentMode>(DEFAULT_ACCENT);

  useEffect(() => {
    setTheme(getStoredTheme());
    setAccent(getStoredAccent());
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
  }, [theme, accent]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    accent,
    setTheme,
    setAccent,
  }), [theme, accent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreferences(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemePreferences must be used inside ThemeProvider');
  }

  return context;
}
