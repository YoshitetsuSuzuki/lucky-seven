/** 6桁の数字コードは 3+3 に半角スペースを挟んで表示する（例: '483916' → '483 916'）。それ以外はそのまま返す */
export function formatCode(code: string): string {
  if (/^\d{6}$/.test(code)) return `${code.slice(0, 3)} ${code.slice(3)}`;
  return code;
}

/** 入力から数字・英大文字以外を取り除き、大文字化して最大6文字に切り詰める */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 6);
}
