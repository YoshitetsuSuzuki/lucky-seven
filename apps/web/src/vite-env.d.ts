/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** 表示用バージョン（未指定なら src/version.ts の既定値） */
  readonly VITE_APP_VERSION?: string;
}
