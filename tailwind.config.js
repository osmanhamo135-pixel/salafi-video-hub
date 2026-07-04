/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--bg-main-rgb) / <alpha-value>)',
        sidebar: 'rgb(var(--bg-sidebar-rgb) / <alpha-value>)',
        panel: 'rgb(var(--bg-panel-rgb) / <alpha-value>)',
        'panel-hover': 'rgb(var(--bg-card-hover-rgb) / <alpha-value>)',
        'elevated-panel': 'rgb(var(--bg-card-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-subtle-rgb) / 0.18)',
        'border-strong': 'rgb(var(--border-subtle-rgb) / 0.34)',
        'muted-text': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-main-rgb) / <alpha-value>)',
        'text-soft': 'rgb(var(--text-soft-rgb) / <alpha-value>)',
        'text-faint': 'rgb(var(--text-faint-rgb) / <alpha-value>)',
        'primary-blue': 'rgb(var(--accent-teal-rgb) / <alpha-value>)',
        'primary-blue-hover': 'rgb(var(--accent-turquoise-rgb) / <alpha-value>)',
        'accent-turquoise': 'rgb(var(--accent-turquoise-rgb) / <alpha-value>)',
        'accent-emerald': 'rgb(var(--accent-emerald-rgb) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue-rgb) / <alpha-value>)',
        'accent-gold': 'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        'danger-red': 'rgb(var(--danger-rgb) / <alpha-value>)',
        'success-green': 'rgb(var(--success-rgb) / <alpha-value>)',
        'warning-orange': 'rgb(var(--warning-rgb) / <alpha-value>)',
      },
      screens: {
        '3xl': '1800px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        'content': '1600px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0,0,0,0.35)',
        'panel': '0 18px 50px rgba(0,0,0,0.36)',
        'teal': '0 0 0 1px rgba(15,185,177,0.18), 0 16px 44px rgba(0,0,0,0.35)',
      }
    },
  },
  plugins: [],
}
