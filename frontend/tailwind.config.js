/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'var(--font-montserrat)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e8f5fd',
          100: '#c5e7f8',
          200: '#9dd6f3',
          300: '#6ec3ed',
          400: '#4db4e8',
          500: '#3199d4',
          600: '#2689c0',
          700: '#1a72a3',
          800: '#125c86',
          900: '#0a3f5e',
        },
        navy: {
          50:  '#e8edf2',
          100: '#c4d0da',
          200: '#9db2c1',
          300: '#7494a8',
          400: '#527f96',
          500: '#2d5c7b',
          600: '#234a65',
          700: '#1a3850',
          800: '#192b3f',
          900: '#0f1c2a',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(25,43,63,0.06), 0 1px 2px -1px rgba(25,43,63,0.04)',
        'card-hover': '0 4px 12px 0 rgba(49,153,212,0.12), 0 1px 3px 0 rgba(25,43,63,0.06)',
        modal: '0 20px 60px -10px rgba(25,43,63,0.25)',
      },
    },
  },
  plugins: [],
};
