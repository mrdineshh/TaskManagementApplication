/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Richer indigo scale (docs/10-OPEN-DECISIONS.md §L) — the previous 5-shade blue was
        // flat and "soulless" per the user's own description; a full 50-950 scale lets every
        // dark:-variant added across the app resolve to a real, intentional shade instead of
        // reusing the same two or three tones everywhere.
        brand: {
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
        },
        // Secondary accent (teal) — used sparingly for "energetic" highlights: leaderboard
        // rank #1, streaks, positive deltas. Never a full page's primary color.
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          900: '#134e4a',
        },
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
