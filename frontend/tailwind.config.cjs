module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5f7', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
        'primary-hover': 'hsl(var(--primary-hover))',
        // Design-system tokens (CSS custom properties declared in styles/index.css)
        'border-hover': 'hsl(var(--border-hover))',
        background: 'hsl(var(--background))',
        'background-elevated': 'hsl(var(--background-elevated))',
        'background-card': 'hsl(var(--background-card))',
        'background-accent': 'hsl(var(--background-accent))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-tertiary': 'hsl(var(--text-tertiary))',
        'text-disabled': 'hsl(var(--text-disabled))',
        slate: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334159',
          800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        severity: {
          extreme: '#ef4444', severe: '#f97316', moderate: '#fbbf24', minor: '#3b82f6',
        },
        success: { 500: '#10b981', 600: '#059669' },
        warning: { 500: '#f59e0b', 600: '#d97706' },
        danger: { 500: '#ef4444', 600: '#dc2626' },
        // Semantic color aliases backed by CSS design-system variables
        emerald: 'hsl(var(--emerald))',
        amber: 'hsl(var(--amber))',
        red: 'hsl(var(--red))',
        purple: 'hsl(var(--purple))',
        teal: 'hsl(var(--teal))',
        blue: 'hsl(var(--primary))',
        orange: 'hsl(var(--amber))',
        sky: 'hsl(var(--teal))',
        destructive: 'hsl(var(--red))',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: '0.625rem', sm: '0.75rem', md: '0.875rem', base: '1rem',
        lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
      },
      spacing: { '72': '18rem', '84': '21rem', '96': '24rem' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
