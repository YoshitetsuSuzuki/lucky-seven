/**
 * ビルド時に切り替える機能フラグ。
 * 配布ビルドで隠し要素を落としたいときに `.env` で指定する。
 */

/** 隠しコマンド「ラッキーモード」を有効にするか（未指定なら有効） */
export const LUCKY_ENABLED: boolean = (import.meta.env.VITE_ENABLE_LUCKY ?? '1') !== '0';
