# ラッキーセブン

友達と遊ぶオンライン カードゲーム（最大12人・CPU対戦あり）。

## 構成
- `packages/engine` ルールエンジン（純粋 TypeScript、Vitest）
- `supabase/` スキーマと Edge Function `act`
- `apps/web` Vite + React クライアント（PWA）

## 初回セットアップ
1. Supabase でプロジェクトを作成し、`Project URL` と `anon key` を控える
2. `npx supabase login` → `npx supabase link --project-ref <ref>`
3. `npx supabase db push` でテーブルを作成
4. `npm run sync-engine && npx supabase functions deploy act --no-verify-jwt`
5. `apps/web/.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を書く
6. `npm install && npm run dev`

## 公開（GitHub Pages）
リポジトリの Settings → Pages → Source を「GitHub Actions」にし、Secrets に
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を登録して `main` に push する。

## 開発
- `npm test` エンジンのテスト
- エンジンを変更したら `npm run sync-engine` してから Edge Function を再デプロイ
