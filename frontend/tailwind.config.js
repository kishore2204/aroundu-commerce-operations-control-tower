/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        /*
         * Blue -> violet brand scale (matches the approved wireframe reference,
         * home.html.txt: --primary-500 #2563eb, --accent-purple #8b5cf6). Same
         * token names (zepto-*) as before this pass so every existing
         * `bg-zepto-600`/`text-zepto-600`/etc. class across ~46 component
         * templates re-colors automatically - no per-file changes needed.
         */
        zepto: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        zgreen: {
          50: '#ecfdf5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 8px 25px -4px rgba(17, 24, 39, 0.06)',
        'card-hover': '0 20px 45px -8px rgba(37, 99, 235, 0.18)',
        glow: '0 10px 24px rgba(37, 99, 235, 0.22)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
        'brand-soft': 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(139,92,246,.12))',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px) scale(.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up .35s cubic-bezier(.4,0,.2,1) both',
        'pop-in': 'pop-in .18s cubic-bezier(.4,0,.2,1) both',
      },
    },
  },
  plugins: [],
};
