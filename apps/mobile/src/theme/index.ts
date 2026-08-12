/**
 * Design tokens shared across every screen — same brand blue as the web app
 * (apps/web/tailwind.config.js `brand-600`), kept in one place so the mobile UI reads as
 * one system instead of each screen inventing its own greys and spacing.
 */
export const colors = {
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  slate: {
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
  },
  white: '#ffffff',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
  success: '#16a34a',
  successBg: '#f0fdf4',
  info: '#2563eb',
} as const;

export const statusCategoryColor: Record<string, string> = {
  todo: colors.slate[400],
  in_progress: colors.brand[600],
  done: colors.success,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.slate[900] },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.slate[900] },
  title: { fontSize: 15, fontWeight: '600' as const, color: colors.slate[800] },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.slate[700] },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.slate[400] },
  label: { fontSize: 11, fontWeight: '600' as const, color: colors.slate[400], textTransform: 'uppercase' as const, letterSpacing: 0.4 },
};

export const shadow = {
  card: {
    shadowColor: colors.slate[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.slate[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
};
