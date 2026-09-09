/**
 * 静的ページ（プライバシーポリシー等）への URL。
 * `import.meta.env.BASE_URL` を基準にするので、サブパス配信でも壊れない。
 */
export function legalUrl(name: 'privacy' | 'terms' | 'support'): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}legal/${name}.html`;
}

export const SUPPORT_EMAIL = 'yoshitetsugames21+lucky7@gmail.com';
