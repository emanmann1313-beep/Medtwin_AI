import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'medtwin_theme_v1';

interface ThemeContextValue {
  theme: ThemeMode;
  isSystemDefault: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  resetToSystemTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialThemeState(): { theme: ThemeMode; isSystemDefault: boolean } {
  if (typeof window === 'undefined') return { theme: 'dark', isSystemDefault: false };
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return { theme: saved, isSystemDefault: false };
    }
  } catch {
    // Ignore storage access errors
  }
  return { theme: 'dark', isSystemDefault: false };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(getInitialThemeState);
  const [theme, setThemeState] = useState<ThemeMode>(initial.theme);
  const [isSystemDefault, setIsSystemDefault] = useState<boolean>(initial.isSystemDefault);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  useEffect(() => {
    if (!isSystemDefault || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (ev: MediaQueryListEvent) => {
      setThemeState(ev.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [isSystemDefault]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    setIsSystemDefault(false);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      setIsSystemDefault(false);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage access errors
      }
      return next;
    });
  }, []);

  const resetToSystemTheme = useCallback(() => {
    setIsSystemDefault(true);
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    setThemeState(getSystemTheme());
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, isSystemDefault, setTheme, toggleTheme, resetToSystemTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
