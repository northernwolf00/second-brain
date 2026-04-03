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

export const darkColors: ColorPalette = {
  bg:            '#09090f',
  surface:       '#111118',
  card:          '#18181f',
  accent:        '#7c6af7',
  accentSoft:    'rgba(124,106,247,0.14)',
  accentDim:     'rgba(124,106,247,0.25)',
  text:          '#ededf5',
  textSecondary: '#9898aa',
  muted:         '#55556a',
  border:        '#232330',
  danger:        '#ff5555',
  tabBar:        '#111118',
  inputBg:       '#0d0d14',
};

export const lightColors: ColorPalette = {
  bg:            '#f2f2f8',
  surface:       '#ffffff',
  card:          '#ffffff',
  accent:        '#6b5ce7',
  accentSoft:    'rgba(107,92,231,0.10)',
  accentDim:     'rgba(107,92,231,0.18)',
  text:          '#1a1a2e',
  textSecondary: '#6b6b82',
  muted:         '#aaaabc',
  border:        '#e4e4ef',
  danger:        '#e53935',
  tabBar:        '#ffffff',
  inputBg:       '#f5f5fb',
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
