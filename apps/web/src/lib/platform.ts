/**
 * 実行環境の判定。Capacitor で包んだネイティブアプリの中かどうか。
 * ブラウザ前提の案内（URL を開き直す等）を出し分けるために使う。
 */
export function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}
