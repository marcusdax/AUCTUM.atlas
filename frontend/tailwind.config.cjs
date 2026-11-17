/**
 * Tailwind theme — AUCTUM × ATLAS brand layer.
 *
 * Palette: parchment #F1F2EA · ink #17231D · oxblood #8C2F22 · sage/gold/navy
 * Type:    Fraunces (display) · Archivo (UI) · IBM Plex Mono (data/labels)
 * Shape:   2px radius, hairline borders, flat elevation.
 */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        'border-hover': 'hsl(var(--border-hover))',
        input: 'hsl(var(--border))',
        ring: 'hsl(var(--primary))',
        background: 'hsl(var(--background))',
        'background-elevated': 'hsl(var(--background-elevated))',
        'background-card': 'hsl(var(--background-card))',
        'background-accent': 'hsl(var(--background-accent))',
        foreground: 'hsl(var(--text-primary))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-tertiary': 'hsl(var(--text-tertiary))',
        'text-disabled': 'hsl(var(--text-disabled))',

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f1f2ea', 100: '#e5e8dc', 200: '#d5dac6', 300: '#b8c2b4',
          400: '#90a095', 500: '#526055', 600: '#3f4d43', 700: '#2a3a32',
          800: '#21302a', 900: '#17231d', 950: '#0e1712',
        },
        'primary-hover': 'hsl(var(--primary-hover))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary, 84 18% 81%))',
          foreground: 'hsl(var(--secondary-foreground, 153 21% 11%))',
        },

        parchment: '#f1f2ea',
        'parchment-deep': '#d5dac6',
        'parchment-warm': '#e9e2d6',
        ink: '#17231d',
        'ink-soft': '#2a3a32',
        navy: '#1f2e33',
        oxblood: '#8c2f22',
        'oxblood-dark': '#7a1f1f',
        sage: '#526055',
        slate: '#536056',
        gold: '#6d592d',
        'gold-bright': '#cb8622',

        // Data-viz / market accents from the AUCTUM estate palette
        farmer: '#315c26',
        roaster: '#1a6666',
        shop: '#1a3a6b',
        consumer: '#5b3a8b',
        patron: '#7a5c14',
        trust: '#0f2244',

        severity: {
          extreme: '#8c2f22',
          severe: '#7e5415',
          moderate: '#cb8622',
          minor: '#1a6666',
          unknown: '#6b7566',
        },
        success: { 500: '#27693b', 600: '#1f5730' },
        warning: { 500: '#7e5415', 600: '#6a4611' },
        danger: { 500: '#8c2f22', 600: '#7a1f1f' },
        emerald: 'hsl(var(--emerald))',
        'emerald-hover': 'hsl(var(--emerald-hover))',
        amber: 'hsl(var(--amber))',
        'amber-hover': 'hsl(var(--amber-hover))',
        red: 'hsl(var(--red))',
        'red-hover': 'hsl(var(--red-hover))',
        purple: 'hsl(var(--purple))',
        teal: 'hsl(var(--teal))',
        blue: 'hsl(var(--primary))',
        orange: 'hsl(var(--orange))',
        sky: 'hsl(var(--teal))',
        destructive: 'hsl(var(--red))',
        slate: {
          50: '#f5f6f0', 100: '#ebece2', 200: '#d8dbcb', 300: '#b8c0ad',
          400: '#909b87', 500: '#6f7c67', 600: '#57634f', 700: '#464f41',
          800: '#333b30', 900: '#222922', 950: '#151a15',
        },
      },
      fontFamily: {
        sans: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        serif: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: '0.6875rem',
        sm: '0.8125rem',
        md: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '4px',
        '2xl': '6px',
        '3xl': '10px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 0 rgb(23 35 29 / 0.04)',
        DEFAULT: '0 1px 2px rgb(23 35 29 / 0.06)',
        md: '0 2px 6px rgb(23 35 29 / 0.08)',
        lg: '0 8px 20px rgb(23 35 29 / 0.10)',
        xl: '0 16px 40px rgb(23 35 29 / 0.14)',
      },
      letterSpacing: {
        label: '0.08em',
        eyebrow: '0.14em',
      },
      spacing: { '72': '18rem', '84': '21rem', '96': '24rem' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
