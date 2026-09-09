import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** navigator.onLine は「回線がある」だけの判定だが、機内モード等の分かりやすい合図になる */
const isOnline = () => navigator.onLine !== false;

/**
 * オフラインのときだけ最上部に細い帯を出す。
 * タップは常に下の画面へ通す（帯が操作を邪魔しないように）。
 */
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, () => true);
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60]" role="status" aria-live="polite">
      <div
        className="animate-fadeUp bg-rose/90 px-3 pb-1.5 text-center text-[12px] font-bold leading-tight text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.9)]"
        style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top))' }}
      >
        オフラインです
        <span className="ml-2 font-normal text-white/80">通信が戻ると自動で再開します</span>
      </div>
    </div>
  );
}
