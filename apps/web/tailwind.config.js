/** @type {import('tailwindcss').Config} */

/** 色はすべて CSS 変数（`src/index.css` のテーマ定義）を参照する。
 *  `/50` のような不透明度指定を効かせるため、変数には "R G B" の数値だけを入れる。 */
const v = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        jp: ['var(--font-jp)'],
      },
      colors: {
        /* 地と面 */
        ink: v('ink'),
        ink2: v('ink2'),
        ink3: v('ink3'),
        ink4: v('ink4'),
        /* 卓（フェルト）と、その上に乗せるもの */
        felt: v('felt'),
        feltink: v('feltink'),
        feltgold: v('feltgold'),
        feltchip: v('feltchip'),
        /* 差し色と文字 */
        gold: v('gold'),
        golddeep: v('golddeep'),
        golddim: v('golddim'),
        cream: v('cream'),
        muted: v('muted'),
        rose: v('rose'),
        frost: v('frost'),
        mint: v('mint'),
        /* 罫線・薄い被せ（暗いテーマでは白、明るいテーマでは墨） */
        edge: v('edge'),
        /* 金箔ボタンの上の文字 / 覆いの黒 */
        foilink: v('foilink'),
        scrim: v('scrim'),
        /* 「7」（ラッキーモードで少し明るくなる） */
        seven: v('seven'),
        sevenlit: v('seven-lit'),
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
          '0%': { backgroundColor: 'rgb(var(--rose-rgb) / 0)' },
          '25%': { backgroundColor: 'rgb(var(--rose-rgb) / .34)' },
          '100%': { backgroundColor: 'rgb(var(--rose-rgb) / 0)' },
        },
        frostIn: {
          '0%': { opacity: '0', transform: 'scale(1.06)' },
          '30%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1)' },
        },
        orangePulse: {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--pulse-rgb) / .65)' },
          '100%': { boxShadow: '0 0 0 18px rgb(var(--pulse-rgb) / 0)' },
        },
        sparkOut: {
          '0%': { opacity: '0', transform: 'translate(-50%,-50%) rotate(var(--a)) translateY(0) scale(.2)' },
          '25%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(-50%,-50%) rotate(var(--a)) translateY(-72px) scale(1)' },
        },
        sevenGlow: {
          '0%,100%': { textShadow: '0 0 0 rgb(var(--seven-rgb) / 0)' },
          '50%': { textShadow: '0 0 18px rgb(var(--seven-rgb) / .95), 0 0 40px rgb(var(--seven-rgb) / .5)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
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
        sheetUp: 'sheetUp 0.32s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
