/** @type {import('tailwindcss').Config} */
export default {
  content:   ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode:  'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1d9bf0',
          dark:    '#1a8cd8',
          light:   '#e8f5fe',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
