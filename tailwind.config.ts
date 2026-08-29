import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Mora da prati @theme blok u app/globals.css — ako se razidu,
      // deo klasa dobija jednu boju a deo drugu.
      colors: {
        brand: {
          50: '#fdf4f2',
          100: '#f9e4e0',
          200: '#f1c5bd',
          300: '#e39c90',
          400: '#d06d5c',
          500: '#ba4433',
          600: '#a4161a',
          700: '#8c1c13',
          800: '#731610',
          900: '#5c120d',
        },
        zlatna: {
          DEFAULT: '#b98f21',
          jaka: '#d9b04a',
          svetla: '#f6edd4',
        },
        primary: {
          DEFAULT: '#a4161a',
          hover: '#8c1c13',
          light: '#f7f2e7',
          dark: '#731610',
        },
        text: {
          DEFAULT: '#2c231b',
          muted: '#6d5c4a',
          light: '#9a8977',
        },
        background: {
          DEFAULT: '#faf6ed',
          alt: '#f2ead9',
          hover: '#eae0ca',
        },
        povrsina: '#fffdf6',
        border: {
          DEFAULT: '#ded0b6',
          dark: '#c9b795',
        },
        error: '#b3261e',
        success: '#4a6b3a',
      },
      fontFamily: {
        display: ['PT Serif', 'Georgia', 'Times New Roman', 'serif'],
        body: ['PT Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-md': ['2rem', { lineHeight: '1.3' }],
        'display-sm': ['1.5rem', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        'section-sm': '3rem',    /* 48px */
        'section-md': '4rem',    /* 64px */
        'section-lg': '5rem',    /* 80px */
        'section-xl': '6rem',    /* 96px */
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
