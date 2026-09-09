/**
 * アプリのバージョン表示。
 * ビルド時に VITE_APP_VERSION を渡せばそちらが優先される（ネイティブ側と揃えるため）。
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

/** アプリ名（画面表示・共有テキストで共通に使う） */
export const APP_NAME = 'ラッキーセブン';
