import React, { createContext, useContext, useState, useEffect } from 'react';
import { Store } from '../store/mmkv';

export interface ColorPalette {
  bg: string;
  surface: string;
  card: string;
  accent: string;
  accentSoft: string;
  accentDim: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  danger: string;
  tabBar: string;
  inputBg: string;
}

// Midnight Blue dark theme
export const darkColors: ColorPalette = {
  bg:            '#0d1117',
  surface:       '#161b22',
  card:          '#21262d',
  accent:        '#388bfd',
  accentSoft:    'rgba(56,139,253,0.14)',
  accentDim:     'rgba(56,139,253,0.25)',
  text:          '#e6edf3',
  textSecondary: '#8b949e',
  muted:         '#484f58',
  border:        '#30363d',
  danger:        '#f85149',
  tabBar:        '#161b22',
  inputBg:       '#0d1117',
};

// Warm Paper light theme
export const lightColors: ColorPalette = {
  bg:            '#faf7f2',
  surface:       '#f0ebe3',
  card:          '#e8e0d0',
  accent:        '#8b6f47',
  accentSoft:    'rgba(139,111,71,0.12)',
  accentDim:     'rgba(139,111,71,0.22)',
  text:          '#2c2416',
  textSecondary: '#6b5030',
  muted:         '#9e8a70',
  border:        '#d4c9b8',
  danger:        '#c0392b',
  tabBar:        '#f0ebe3',
  inputBg:       '#faf7f2',
};

interface ThemeCtx {
  isDark: boolean;
  colors: ColorPalette;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: true,
  colors: darkColors,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    Store.getTheme().then(v => {
      if (v === 'light') setIsDark(false);
    });
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev;
      Store.setTheme(next ? 'dark' : 'light');
      return next;
    });
  };

  return React.createElement(
    ThemeContext.Provider,
    { value: { isDark, colors: isDark ? darkColors : lightColors, toggle } },
    children,
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}
