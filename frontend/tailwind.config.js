/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5569ff',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#6E759F',
          foreground: '#ffffff'
        },
        success: {
          DEFAULT: '#57CA22',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#FFA319',
          foreground: '#1f2937'
        },
        error: {
          DEFAULT: '#FF1943',
          foreground: '#ffffff'
        },
        info: {
          DEFAULT: '#33C2FF',
          foreground: '#1f2937'
        },
        surface: '#f2f5f9',
        'surface-muted': '#eef2ff',
        'neutral-ink': '#223354',
        'status-draft': '#6E759F',
        'status-awaiting': '#FFA319',
        'status-committed': '#57CA22'
      },
      boxShadow: {
        'proposal-card':
          '0px 9px 16px rgba(159, 162, 191, .18), 0px 2px 2px rgba(159, 162, 191, 0.32)'
      }
    }
  },
  plugins: []
};
