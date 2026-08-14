import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, makeShadow, makeTypography, spacing, radius, type ThemeColors, type Typography, type Shadow } from './index';

const THEME_KEY = 'taskapp.theme';
export type ThemePreference = 'light' | 'dark' | 'system';

interface AppTheme {
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  colors: ThemeColors;
  typography: Typography;
  shadow: Shadow;
  spacing: typeof spacing;
  radius: typeof radius;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<AppTheme | null>(null);

/**
 * Dark mode for mobile (docs/10-OPEN-DECISIONS.md §N — closes the mobile-parity gap from
 * §L8). Mirrors apps/web's useTheme.ts: a persisted light/dark/system preference, defaulting
 * to the OS scheme until the user explicitly toggles. Persisted via expo-secure-store (already
 * a dependency for the session's refresh token) rather than adding AsyncStorage as a new one.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      setHydrated(true);
    });
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(THEME_KEY, pref);
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme ?? Appearance.getColorScheme() ?? 'light') : preference;

  const value = useMemo<AppTheme>(() => {
    const colors = scheme === 'dark' ? darkColors : lightColors;
    return {
      scheme,
      preference,
      colors,
      typography: makeTypography(colors),
      shadow: makeShadow(scheme),
      spacing,
      radius,
      setPreference,
    };
  }, [scheme, preference, setPreference]);

  // Don't render with a possibly-wrong (pre-hydration) preference for longer than a tick —
  // 'system' is a safe default even before SecureStore resolves, so no loading gate is needed.
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme() called outside <ThemeProvider>');
  return ctx;
}
