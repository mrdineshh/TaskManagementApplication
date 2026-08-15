/**
 * Design tokens — mirrors apps/web/tailwind.config.js's "Studio Desk" forest-green/ochre
 * system (docs/10-OPEN-DECISIONS.md §M5) so mobile and web read as one product. `spacing`/
 * `radius` are theme-independent; colors/typography/shadow come from `useAppTheme()`
 * (see `./ThemeProvider.tsx`) since React Native has no CSS custom-property equivalent —
 * every color has to be resolved per-render, not baked into a module-level StyleSheet.
 */

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
// Softer, larger radii (Studio Desk's "unhurried" feel) — one notch up from the old scale,
// matching web's borderRadius bump in tailwind.config.js.
export const radius = { sm: 8, md: 14, lg: 18, xl: 24, pill: 999 } as const;

const brand = {
  50: '#eff5f2',
  100: '#dceae3',
  200: '#b7d6c9',
  300: '#8fbeaa',
  400: '#62a088',
  500: '#2b6357',
  600: '#235247',
  700: '#1d4339',
  800: '#17352e',
  900: '#112722',
  950: '#0a1714',
} as const;

const accent = {
  100: '#f5e4c2',
  300: '#e3b563',
  400: '#d69f3e',
  500: '#c98a2c',
  600: '#ad7322',
  900: '#4a310e',
} as const;

const slateLight = {
  50: '#faf8f4',
  100: '#f3eee5',
  200: '#e8e0d2',
  300: '#d6cab4',
  400: '#b8a98d',
  500: '#97876d',
  600: '#786b54',
  700: '#5b5040',
  800: '#40372a',
  900: '#2b2620',
} as const;

// A dark-mode "slate" scale, roughly the light one reversed and deepened — same role as
// web's Tailwind dark: variants, just resolved into concrete values here instead of expressed
// as a class-name suffix. Kept warm (brownish near-black), not the old cool-navy dark, so
// dark mode carries the same "paper planner" character as light mode.
const slateDark = {
  50: '#1a160f',
  100: '#221c14',
  200: '#2b2620',
  300: '#40372a',
  400: '#5b5040',
  500: '#786b54',
  600: '#97876d',
  700: '#b8a98d',
  800: '#d6cab4',
  900: '#f3eee5',
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

// Fraunces (headings) + Karla (everything else) — mirrors web's font pairing (tailwind.config.js
// fontFamily). Loaded via expo-font in App.tsx before first render (see useFonts there); RN
// needs the exact per-weight family name rather than a separate fontWeight prop, so none of
// these also set fontWeight.
export function makeTypography(colors: ThemeColors) {
  return {
    h1: { fontSize: 24, fontFamily: 'Fraunces_700Bold', color: colors.text },
    h2: { fontSize: 18, fontFamily: 'Fraunces_600SemiBold', color: colors.text },
    title: { fontSize: 15, fontFamily: 'Karla_600SemiBold', color: colors.slate[800] },
    body: { fontSize: 14, fontFamily: 'Karla_400Regular', color: colors.textSoft },
    caption: { fontSize: 12, fontFamily: 'Karla_500Medium', color: colors.slate[400] },
    label: {
      fontSize: 11,
      fontFamily: 'Karla_600SemiBold',
      color: colors.slate[400],
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    },
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
