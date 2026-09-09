import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 「戻る」。直前の画面があればそこへ、無ければ（URL 直開きなど）ホームへ。
 * react-router は履歴 state に idx を積むので、それで判定する。
 */
export function useGoBack(): () => void {
  const nav = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav('/', { replace: true });
  }, [nav]);
}
