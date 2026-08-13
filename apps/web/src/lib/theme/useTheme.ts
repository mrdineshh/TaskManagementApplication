import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'taskapp.theme';
export type ThemePreference = 'light' | 'dark' | 'system';

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * Dark mode (docs/10-OPEN-DECISIONS.md §L — "dark mode from the start"). The resolved class
 * is applied to <html> synchronously before React mounts too (index.html's inline script,
 * mirroring this same resolution logic) to avoid a flash of the wrong theme on load.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(
    () => (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? 'system',
  );

  useEffect(() => {
    applyTheme(resolveTheme(preference));
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_KEY, next);
    setPreference(next);
  }, []);

  return { theme: resolveTheme(preference), preference, setTheme };
}
