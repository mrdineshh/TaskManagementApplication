/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Studio Desk" direction (docs/10-OPEN-DECISIONS.md §M5) — forest green replacing the
        // indigo scale from §L. Full 50-950 so every existing dark:-variant across the app
        // (originally built for the indigo scale) resolves to a real forest-green shade instead
        // of needing a per-file rewrite — the same "redefine the scale" trick used for slate
        // below, and the one §L3 already established for the dark-mode sweep.
        brand: {
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
        },
        // Secondary accent (ochre) — used sparingly for "energetic" highlights: leaderboard
        // rank #1, streaks, positive deltas. Never a full page's primary color.
        accent: {
          50: '#fbf3e4',
          100: '#f5e4c2',
          200: '#eccb92',
          300: '#e3b563',
          400: '#d69f3e',
          500: '#c98a2c',
          600: '#ad7322',
          700: '#8c5d1b',
          800: '#6b4715',
          900: '#4a310e',
          950: '#2e1e08',
        },
        // Warm putty/greige replacing Tailwind's default cool-blue slate — every existing
        // slate-* / dark:slate-* utility across the app (body bg, card borders, muted text)
        // picks this up automatically with zero per-file edits, same mechanism as brand above.
        slate: {
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
          950: '#1a160f',
        },
      },
      fontFamily: {
        // Karla (humanist grotesk, warm terminals) for body/UI chrome; Fraunces (soft serif)
        // reserved for headings via the @layer base rule in src/styles/index.css — "paper
        // planner" character carried into real typography, not just color (docs §M5).
        sans: ['Karla', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Softer, larger radii app-wide (Studio Desk's "unhurried" feel) — bumped one notch
        // up the scale so every existing rounded-md/lg/xl/2xl utility picks it up for free.
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.28s ease-out',
        'pop-in': 'popIn 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
