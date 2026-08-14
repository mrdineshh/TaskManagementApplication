/**
 * Design tokens — mirrors apps/web/tailwind.config.js's indigo/teal system
 * (docs/10-OPEN-DECISIONS.md §N) so mobile and web read as one product again after web's
 * Phase 6 redesign diverged from this file's old flat blue. `spacing`/`radius` are
 * theme-independent; colors/typography/shadow come from `useAppTheme()`
 * (see `./ThemeProvider.tsx`) since React Native has no CSS custom-property equivalent —
 * every color has to be resolved per-render, not baked into a module-level StyleSheet.
 */

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

const brand = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
} as const;

const accent = {
  100: '#ccfbf1',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  900: '#134e4a',
} as const;

const slateLight = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
} as const;

// A dark-mode "slate" scale, roughly the light one reversed and deepened — same role as
// web's Tailwind dark: variants (Phase 6), just resolved into concrete values here instead
// of expressed as a class-name suffix.
const slateDark = {
  50: '#0b0c17',
  100: '#10111f',
  200: '#181a2e',
  300: '#2a2c47',
  400: '#3d3f61',
  500: '#6f7292',
  600: '#8b8eb0',
  700: '#b4b7d6',
  800: '#d5d7ef',
  900: '#eef0ff',
} as const;

export type ThemeColors = ReturnType<typeof buildColors>;

function buildColors(scheme: 'light' | 'dark') {
  const slate = scheme === 'light' ? slateLight : slateDark;
  const isDark = scheme === 'dark';
  return {
    brand,
    accent,
    slate,
    white: '#ffffff',
    bg: isDark ? slateDark[50] : slateLight[50],
    surface: isDark ? slateDark[100] : '#ffffff',
    surfaceAlt: isDark ? slateDark[200] : slateLight[100],
    border: isDark ? slateDark[300] : slateLight[200],
    borderSoft: isDark ? slateDark[200] : slateLight[100],
    text: isDark ? slateDark[900] : slateLight[900],
    textSoft: isDark ? slateDark[700] : slateLight[700],
    // Brand primary action color — indigo-600 reads fine on white, but needs to lighten to
    // indigo-400 to stay legible against a near-black surface (same swap web's dark: variants
    // make for text-brand-600 → dark:text-brand-400).
    primary: isDark ? brand[400] : brand[600],
    danger: isDark ? '#ff8080' : '#dc2626',
    dangerBg: isDark ? '#2c1414' : '#fef2f2',
    warning: isDark ? '#f2b64d' : '#d97706',
    warningBg: isDark ? '#2c2312' : '#fffbeb',
    success: isDark ? '#4ade80' : '#16a34a',
    successBg: isDark ? '#0f2418' : '#f0fdf4',
    info: isDark ? brand[400] : brand[600],
  };
}

export const lightColors = buildColors('light');
export const darkColors = buildColors('dark');

export function makeTypography(colors: ThemeColors) {
  return {
    h1: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
    h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
    title: { fontSize: 15, fontWeight: '600' as const, color: colors.slate[800] },
    body: { fontSize: 14, fontWeight: '400' as const, color: colors.textSoft },
    caption: { fontSize: 12, fontWeight: '500' as const, color: colors.slate[400] },
    label: { fontSize: 11, fontWeight: '600' as const, color: colors.slate[400], textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  };
}
export type Typography = ReturnType<typeof makeTypography>;

export function makeShadow(scheme: 'light' | 'dark') {
  const shadowColor = scheme === 'dark' ? '#000000' : '#0f172a';
  return {
    card: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: scheme === 'dark' ? 0.4 : 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    raised: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: scheme === 'dark' ? 0.5 : 0.1,
      shadowRadius: 10,
      elevation: 6,
    },
  };
}
export type Shadow = ReturnType<typeof makeShadow>;

export { useAppTheme, ThemeProvider } from './ThemeProvider';
