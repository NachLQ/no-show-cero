/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Runtime theme tokens support Tailwind opacity modifiers.

        // Silys v1.0 — Black Interface. Mismos tokens que silys-landing/style.css.
        marca: { DEFAULT: 'rgb(var(--v-action) / <alpha-value>)', claro: 'rgb(var(--v-accent) / <alpha-value>)', oscuro: 'rgb(var(--v-action) / <alpha-value>)', 50: 'rgb(var(--v-card) / <alpha-value>)', 100: 'rgb(var(--v-card) / <alpha-value>)', 200: 'rgb(var(--v-border) / <alpha-value>)', 300: 'rgb(var(--v-accent) / <alpha-value>)', 400: 'rgb(var(--v-accent) / <alpha-value>)', 500: 'rgb(var(--v-action) / <alpha-value>)', 600: 'rgb(var(--v-action) / <alpha-value>)', 700: 'rgb(var(--v-action) / <alpha-value>)', 800: 'rgb(var(--v-action) / <alpha-value>)', 900: 'rgb(var(--v-action) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--v-accent) / <alpha-value>)', light: 'rgb(var(--v-accent) / <alpha-value>)', dark: 'rgb(var(--v-action) / <alpha-value>)' },
        ink: { bg: 'rgb(var(--v-bg) / <alpha-value>)', surface: 'rgb(var(--v-surface) / <alpha-value>)', card: 'rgb(var(--v-card) / <alpha-value>)', cardhover: 'rgb(var(--v-hover) / <alpha-value>)', text: 'rgb(var(--v-text) / <alpha-value>)', muted: 'rgb(var(--v-muted) / <alpha-value>)', dim: 'rgb(var(--v-dim) / <alpha-value>)' },
        paper: { bg: 'rgb(var(--v-bg) / <alpha-value>)', surface: 'rgb(var(--v-surface) / <alpha-value>)', card: 'rgb(var(--v-card) / <alpha-value>)', cardhover: 'rgb(var(--v-hover) / <alpha-value>)', text: 'rgb(var(--v-text) / <alpha-value>)', muted: 'rgb(var(--v-muted) / <alpha-value>)', dim: 'rgb(var(--v-dim) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
