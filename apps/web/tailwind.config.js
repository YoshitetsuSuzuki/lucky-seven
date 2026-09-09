/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Zen Kaku Gothic New"', 'Georgia', 'serif'],
        jp: ['"Zen Kaku Gothic New"', '"Hiragino Sans"', '"Noto Sans JP"', 'sans-serif'],
      },
      colors: {
        ink: '#0a0e1a',
        ink2: '#101728',
        ink3: '#18213a',
        ink4: '#232e4b',
        felt: '#124633',
        gold: '#f2c14e',
        golddeep: '#c9932b',
        golddim: '#6f5a24',
        cream: '#f6f1e3',
        muted: '#8d95ab',
        rose: '#e0475e',
        frost: '#8fd8ee',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.55), 0 6px 16px rgba(0,0,0,.42)',
        lamp: '0 -1px 0 rgba(246,241,227,.06) inset, 0 18px 40px -18px rgba(242,193,78,.35)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.4) rotate(-8deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-7px)' },
          '45%': { transform: 'translateX(6px)' },
          '70%': { transform: 'translateX(-3px)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-60px)', opacity: '0' },
        },
        redFlash: {
          '0%': { backgroundColor: 'rgba(224,71,94,0)' },
          '25%': { backgroundColor: 'rgba(224,71,94,.34)' },
          '100%': { backgroundColor: 'rgba(224,71,94,0)' },
        },
        frostIn: {
          '0%': { opacity: '0', transform: 'scale(1.06)' },
          '30%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1)' },
        },
        orangePulse: {
          '0%': { boxShadow: '0 0 0 0 rgba(230,126,34,.65)' },
          '100%': { boxShadow: '0 0 0 18px rgba(230,126,34,0)' },
        },
        sparkOut: {
          '0%': { opacity: '0', transform: 'translate(-50%,-50%) rotate(var(--a)) translateY(0) scale(.2)' },
          '25%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(-50%,-50%) rotate(var(--a)) translateY(-72px) scale(1)' },
        },
        sevenGlow: {
          '0%,100%': { textShadow: '0 0 0 rgba(242,193,78,0)' },
          '50%': { textShadow: '0 0 18px rgba(242,193,78,.95), 0 0 40px rgba(242,193,78,.5)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        pop: 'pop 0.28s cubic-bezier(.2,.9,.25,1.2)',
        shake: 'shake 0.42s ease-in-out',
        floatUp: 'floatUp 1.8s ease-out forwards',
        redFlash: 'redFlash 0.7s ease-out',
        frostIn: 'frostIn 1.1s ease-out forwards',
        orangePulse: 'orangePulse 0.8s ease-out',
        sparkOut: 'sparkOut 1.1s ease-out forwards',
        sevenGlow: 'sevenGlow 1.4s ease-in-out 2',
        fadeUp: 'fadeUp 0.3s ease-out',
        riseIn: 'riseIn 0.4s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
