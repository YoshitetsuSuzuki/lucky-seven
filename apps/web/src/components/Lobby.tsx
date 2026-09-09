import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Settings } from '@lucky7/engine';
import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { formatCode } from '../lib/code';

const TURN_OPTIONS: { label: string; value: Settings['turnSeconds'] }[] = [
  { label: '20秒', value: 20 }, { label: '1分', value: 60 }, { label: '無制限', value: null },
];
const POINT_TARGETS = [100, 200, 300];
const ROUND_TARGETS = [3, 5, 10];

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${active ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'} disabled:opacity-40 disabled:cursor-default`}
    >
      {children}
    </button>
  );
}

export default function Lobby({ room, players, me, isHost }: ScreenProps) {
  const { busy, error, run } = useAct(room.code);
  const [copied, setCopied] = useState(false);
  const seated = players.filter((p) => p.seat !== null);
  const url = `${location.origin}${location.pathname}#/r/${room.code}`;

  const setSettings = (patch: Partial<Settings>) => {
    const next: Settings = { ...room.settings, ...patch };
    if (patch.endMode && patch.endMode !== room.settings.endMode) next.target = patch.endMode === 'points' ? 200 : 5;
    void run('update_settings', { settings: next });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('この URL を共有してください', url); }
  };

  return (
    <div className="min-h-full p-5 max-w-lg mx-auto flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">ラッキー<span className="text-amber-400">7</span></h1>
        <div className="text-right">
          <div className="text-xs text-slate-400">ルームコード</div>
          <div className="font-mono text-2xl tracking-widest text-amber-400">{formatCode(room.code)}</div>
        </div>
      </header>

      <button onClick={copy} className="rounded-xl bg-slate-800 py-3 font-bold">
        {copied ? 'コピーしました' : '招待URLをコピー'}
      </button>

      <section>
        <h2 className="text-sm text-slate-400 mb-2">参加者 {seated.length}/12</h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3">
              <span className="font-bold flex-1">
                {p.name}
                {p.id === room.host_player_id && <span className="ml-2 text-xs text-amber-400">ホスト</span>}
                {p.id === me.id && <span className="ml-2 text-xs text-slate-400">あなた</span>}
                {p.seat === null && <span className="ml-2 text-xs text-slate-500">観戦</span>}
              </span>
              {p.is_cpu && <span className="text-xs rounded bg-slate-700 px-2 py-0.5">CPU</span>}
              {p.is_cpu && isHost && (
                <button disabled={busy} onClick={() => void run('remove_cpu', { playerId: p.id })} className="px-3 py-2 text-slate-400 text-sm">削除</button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <button disabled={busy || seated.length >= 12} onClick={() => void run('add_cpu')} className="mt-3 w-full rounded-xl border border-slate-700 py-2 text-sm disabled:opacity-40">
            ＋ CPU を追加
          </button>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm text-slate-400 mb-2">手番の制限時間</h2>
          <div className="flex gap-2">
            {TURN_OPTIONS.map((o) => (
              <Chip key={String(o.value)} active={room.settings.turnSeconds === o.value} disabled={!isHost || busy} onClick={() => setSettings({ turnSeconds: o.value })}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm text-slate-400 mb-2">終了条件</h2>
          <div className="flex gap-2 mb-2">
            <Chip active={room.settings.endMode === 'points'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'points' })}>目標点</Chip>
            <Chip active={room.settings.endMode === 'rounds'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'rounds' })}>ラウンド数</Chip>
          </div>
          <div className="flex gap-2">
            {(room.settings.endMode === 'points' ? POINT_TARGETS : ROUND_TARGETS).map((t) => (
              <Chip key={t} active={room.settings.target === t} disabled={!isHost || busy} onClick={() => setSettings({ target: t })}>
                {t}{room.settings.endMode === 'points' ? '点' : 'R'}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {isHost ? (
        <button disabled={busy || seated.length < 2} onClick={() => void run('start')} className="rounded-xl bg-amber-400 text-slate-900 font-bold py-4 text-lg disabled:opacity-40">
          ゲーム開始（{seated.length}人）
        </button>
      ) : (
        <p className="text-center text-slate-400">ホストの開始を待っています…</p>
      )}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div>
  );
}
