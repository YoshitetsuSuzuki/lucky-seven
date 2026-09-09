/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: { '0%': { transform: 'scale(0.4) rotate(-8deg)', opacity: '0' }, '100%': { transform: 'scale(1) rotate(0)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
        floatUp: { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-60px)', opacity: '0' } },
      },
      animation: { pop: 'pop 0.25s ease-out', shake: 'shake 0.4s ease-in-out', floatUp: 'floatUp 1.8s ease-out forwards' },
    },
  },
  plugins: [],
};
