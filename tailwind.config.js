/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#FFF1F7',
          100: '#FFE3EF',
          200: '#FFC7E0',
          300: '#FF9DC8',
          400: '#FF69A9',
          500: '#F43F8E',
          600: '#E01E75',
          700: '#BD125E',
          800: '#9B1250',
          900: '#7F1345',
        },
        ink: {
          50: '#F7F7FB',
          100: '#EFEFF5',
          200: '#E1E1EC',
          300: '#C7C7D9',
          400: '#9A9AB4',
          500: '#6F6F8C',
          600: '#52526B',
          700: '#3D3D52',
          800: '#2A2A3A',
          900: '#1A1A26',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(24,20,40,.04), 0 8px 24px -12px rgba(24,20,40,.12)',
        lift: '0 2px 4px rgba(24,20,40,.05), 0 18px 40px -16px rgba(224,30,117,.28)',
        ring: '0 0 0 4px rgba(244,63,142,.12)',
      },
      borderRadius: {
        xl2: '1.125rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(244,63,142,.45)' },
          '70%': { boxShadow: '0 0 0 10px rgba(244,63,142,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(244,63,142,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .38s cubic-bezier(.21,.9,.35,1) both',
        'fade-in': 'fade-in .3s ease both',
        'pop-in': 'pop-in .22s cubic-bezier(.21,.9,.35,1) both',
        'slide-in': 'slide-in .28s cubic-bezier(.21,.9,.35,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
