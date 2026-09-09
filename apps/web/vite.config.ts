import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

/**
 * 同梱した書体から、古い `.woff` の指定だけを落とす。
 * Zen Kaku Gothic New は日本語を 100 以上の小さな塊に分けて持っているので、
 * woff2 だけに絞るだけで CSS も配布物も半分になる（woff2 は iOS 10 / 全モダン環境で使える）。
 */
const woff2Only = {
  name: 'lucky7-woff2-only',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('@fontsource') || !id.split('?')[0].endsWith('.css')) return null;
    return { code: code.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, ''), map: null };
  },
};

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    woff2Only,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ラッキーセブン',
        lang: 'ja',
        short_name: 'ラッキー7',
        description: '友達と遊ぶプレス・ユア・ラック カードゲーム',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@lucky7/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts') },
  },
  server: { fs: { allow: [path.resolve(__dirname, '../..')] } },
});
