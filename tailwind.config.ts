import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Token editorial — nilai sesungguhnya di CSS variables (globals.css)
        paper: 'var(--paper)',
        mist: 'var(--mist)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        grid: 'var(--grid)',
        blue: {
          DEFAULT: 'var(--blue)',
          ink: 'var(--blue-ink)',
          wash: 'var(--blue-wash)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          wash: 'var(--danger-wash)',
          line: 'var(--danger-line)',
        },
        ok: {
          DEFAULT: 'var(--ok)',
          wash: 'var(--ok-wash)',
          line: 'var(--ok-line)',
        },
        // Palet brand lama — masih dirujuk beberapa kelas transisi
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb5ff',
          400: '#598dff',
          500: '#3366ff',
          600: '#1f47f5',
          700: '#1836e1',
          800: '#1a2eb6',
          900: '#1c2d8f',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['var(--font-data)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        token: 'var(--radius)',
      },
    },
  },
  plugins: [],
};

export default config;
