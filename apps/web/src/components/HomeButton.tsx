import { useNavigate } from 'react-router-dom';

/**
 * ホームへ戻るボタン。対局中は誤タップ防止に一度だけ確認する。
 * 席はサーバーに残るので、同じ URL を開けば復帰できる。
 */
export default function HomeButton({ inGame = false, className = '' }: { inGame?: boolean; className?: string }) {
  const nav = useNavigate();
  const go = () => {
    if (inGame && !window.confirm('対局中です。ホームに戻りますか？\n（席は残ります。同じURLからいつでも戻れます）')) return;
    nav('/');
  };
  return (
    <button
      type="button"
      onClick={go}
      aria-label="ホームへ戻る"
      className={`flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-edge/10 bg-edge/5 px-3 text-[13px] font-bold leading-none text-muted transition active:scale-95 ${className}`}
    >
      <span aria-hidden="true">⌂</span>
      ホーム
    </button>
  );
}
