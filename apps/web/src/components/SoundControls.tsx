import { setBgmOn, setSfxOn, setTableBgmOn, unlock } from '../lib/audio';
import { useBgmEnabled, useSfxEnabled, useTableBgm } from '../hooks/useSound';

/**
 * BGM と効果音の切り替え。文字を出して「止め方が分かる」ことを最優先。
 * scope='table'（卓・結果）は既定で BGM を鳴らさないので、
 * 表示も「BGM 設定 かつ 卓で鳴らす」の両方が立っているときだけオン。
 */
export default function SoundControls({
  scope = 'lobby',
  className = '',
}: {
  scope?: 'lobby' | 'table';
  className?: string;
}) {
  const bgmPref = useBgmEnabled();
  const tableBgm = useTableBgm();
  const sfx = useSfxEnabled();
  const bgm = scope === 'table' ? bgmPref && tableBgm : bgmPref;

  const toggleBgm = () => {
    unlock(); // ユーザー操作のうちに自動再生制限を外す
    const next = !bgm;
    if (scope === 'table') {
      // 卓で OFF にしてもロビーの設定そのものは残す（次のロビーではまた鳴る）
      setTableBgmOn(next);
      if (next) setBgmOn(true);
    } else {
      setBgmOn(next);
    }
  };

  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <button
        type="button"
        aria-pressed={bgm}
        onClick={toggleBgm}
        className={`flex min-h-[40px] items-center rounded-full border px-3 text-[13px] font-bold leading-none transition active:scale-95 ${
          bgm ? 'border-gold/45 bg-gold/12 text-gold' : 'border-edge/10 bg-edge/5 text-muted'
        }`}
      >
        ♪ BGM {bgm ? 'オン' : 'オフ'}
      </button>
      <button
        type="button"
        aria-pressed={sfx}
        onClick={() => {
          unlock();
          setSfxOn(!sfx);
        }}
        className={`flex min-h-[40px] items-center rounded-full border px-2.5 text-[11px] font-bold leading-none transition active:scale-95 ${
          sfx ? 'border-gold/30 bg-gold/8 text-cream/85' : 'border-edge/10 bg-edge/5 text-muted line-through'
        }`}
      >
        効果音
      </button>
    </div>
  );
}
