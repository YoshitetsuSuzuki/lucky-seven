import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const EMOJIS = ['👍', '😱', '🔥', '😂'];
interface Floating { id: number; emoji: string; name: string; x: number }

export default function ReactionBar({ code, name }: { code: string; name: string }) {
  const [floating, setFloating] = useState<Floating[]>([]);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const ch = supabase.channel(`room:${code}:reactions`, { config: { broadcast: { self: true } } });
    ch.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const item: Floating = { id: seq.current++, emoji: payload.emoji, name: payload.name, x: 10 + Math.random() * 70 };
      setFloating((f) => [...f, item]);
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== item.id)), 1800);
    }).subscribe();
    channel.current = ch;
    return () => { void supabase.removeChannel(ch); channel.current = null; };
  }, [code]);

  const send = (emoji: string) => {
    void channel.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, name } });
  };

  return (
    <>
      <div className="flex justify-center gap-2">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => send(e)} className="h-10 w-10 rounded-full bg-slate-800 text-xl active:scale-90 transition">{e}</button>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-28 h-40 z-30">
        {floating.map((f) => (
          <div key={f.id} className="absolute animate-floatUp text-center" style={{ left: `${f.x}%` }}>
            <div className="text-3xl">{f.emoji}</div>
            <div className="text-[10px] text-slate-300">{f.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
