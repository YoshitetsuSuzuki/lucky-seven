import { setSoundOn, unlock } from '../lib/audio';
import { useSoundEnabled } from '../hooks/useSound';

export default function SoundToggle({ className = '' }: { className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      aria-label={on ? '音を消す' : '音を出す'}
      aria-pressed={on}
      onClick={() => {
        unlock();
        setSoundOn(!on);
      }}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-base transition active:scale-90 ${
        on ? 'border-gold/45 bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-muted'
      } ${className}`}
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}
