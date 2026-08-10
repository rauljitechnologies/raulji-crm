/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#EFF4FF',
          100: '#DBE6FE',
          200: '#BFD3FE',
          300: '#93B4FD',
          400: '#6090FA',
          500: '#3B76F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        indigoX: {
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        teal: {
          500: '#14B8A6',
        },
        surface: 'var(--surface)',
        canvas:  'var(--bg)',
        ink:     'var(--text)',
        'ink-2': 'var(--text-2)',
        line:    'var(--border)',
      },
      borderRadius: {
        'xl2': '18px',
        'xl3': '22px',
      },
      boxShadow: {
        'xs':   'var(--shadow-xs)',
        'card': 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        'pop':  'var(--shadow-lg)',
        'modal': 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
};
