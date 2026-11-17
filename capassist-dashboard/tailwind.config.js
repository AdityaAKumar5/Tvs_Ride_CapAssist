/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // surfaces and text flip with the theme (see src/styles/index.css)
        bg: 'var(--bg)', panel: 'var(--panel)', soft: 'var(--soft)', line: 'var(--line)',
        ink: 'var(--ink)', muted: 'var(--muted)', head: 'var(--head)',
        // TVS-inspired brand palette (original, not official corporate values)
        navy: '#071F46', blue: '#0B3A83', electric: '#2474D2', racing: '#E11B22',
        // engineering signal colours
        ok: '#16A34A', denied: '#DC2626', cold: '#EAB308', regen: '#F59E0B', uc: '#0891B2',
        lead: '#64748B', lithium: '#7C3AED', conv: '#2563EB', fallback: '#F97316', inactive: '#94A3B8',
      },
      fontFamily: {
        tech: ['Rajdhani', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(7,31,70,0.06), 0 4px 14px rgba(7,31,70,0.05)' },
    },
  },
  plugins: [],
};
