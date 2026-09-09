import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Settings } from '@lucky7/engine';
import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { useBgm } from '../hooks/useSound';
import { formatCode } from '../lib/code';
import { APP_NAME } from '../version';
import SoundControls from './SoundControls';
import HomeButton from './HomeButton';
import { CardBack } from './CardView';

const TURN_OPTIONS: { label: string; value: Settings['turnSeconds'] }[] = [
  { label: '20秒', value: 20 },
  { label: '1分', value: 60 },
  { label: '無制限', value: null },
];
const POINT_TARGETS = [100, 200, 300];
const ROUND_TARGETS = [3, 5, 10];

/** 招待の小ボタン（コピー・共有） */
const INVITE_BTN =
  'flex min-h-[34px] items-center rounded-full border border-white/15 bg-black/25 px-3 text-xs font-bold leading-none text-cream/80 transition active:scale-95';

/** ヘッダーの小さな丸ボタン（遊び方・情報） */
const ICON_BTN =
  'flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[15px] font-bold leading-none text-muted transition active:scale-95';

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-95 ${
        active ? 'gold-foil text-[#3a2a06] shadow-[0_8px_20px_-10px_rgba(242,193,78,.9)]' : 'border border-white/10 bg-ink3 text-cream/65'
      } disabled:cursor-default disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 font-display text-[11px] font-extrabold tracking-[0.28em] text-cream/35">{children}</h2>;
}

export default function Lobby({ room, players, me, isHost }: ScreenProps) {
  const { busy, error, run } = useAct(room.code);
  const [copied, setCopied] = useState(false);
  // 端末の共有シート（LINE などへ直接送れる）。無い環境ではコピーだけ出す
  const [canShare] = useState(() => typeof navigator.share === 'function');
  const seated = players.filter((p) => p.seat !== null);
  const url = `${location.origin}${location.pathname}#/r/${room.code}`;
  useBgm();

  const setSettings = (patch: Partial<Settings>) => {
    const next: Settings = { ...room.settings, ...patch };
    if (patch.endMode && patch.endMode !== room.settings.endMode) next.target = patch.endMode === 'points' ? 200 : 5;
    void run('update_settings', { settings: next });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('この URL を共有してください', url);
    }
  };
  const share = async () => {
    try {
      await navigator.share({
        title: APP_NAME,
        text: `「${APP_NAME}」で対戦しませんか？ ルームコード ${formatCode(room.code)}`,
        url,
      });
    } catch {
      /* 共有シートを閉じただけ。何も出さない */
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 p-5">
      <header className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <h1 className="mr-auto font-display text-2xl font-extrabold tracking-tight">
          ラッキー<span className="text-gold">7</span>
        </h1>
        <Link to="/help" aria-label="遊び方" className={ICON_BTN}>
          <span aria-hidden>？</span>
        </Link>
        <Link to="/about" aria-label="設定・情報" className={ICON_BTN}>
          <span aria-hidden>⚙</span>
        </Link>
        <HomeButton />
        <SoundControls />
      </header>

      <section className="felt flex items-center gap-4 rounded-3xl p-4">
        <div className="relative shrink-0" style={{ width: 56, height: 78 }}>
          <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(-8deg) translateX(-4px)', opacity: 0.75 }} />
          <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(4deg)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[10px] font-extrabold tracking-[0.3em] text-cream/45">ルームコード</div>
          <div className="font-display text-[32px] font-extrabold leading-tight tracking-[0.12em] text-gold [text-shadow:0_2px_16px_rgba(242,193,78,.35)]">
            {formatCode(room.code)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button onClick={copy} className={INVITE_BTN}>
              {copied ? 'コピーしました' : '招待URLをコピー'}
            </button>
            {canShare && (
              <button onClick={() => void share()} className={INVITE_BTN}>
                <span aria-hidden className="mr-1">
                  ↗
                </span>
                招待を送る
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>参加者 {seated.length}/12</SectionTitle>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="lacquer flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-bold">
                {p.name}
                {p.id === room.host_player_id && <span className="ml-2 text-[11px] font-bold text-gold">ホスト</span>}
                {p.id === me.id && <span className="ml-2 text-[11px] text-cream/40">あなた</span>}
                {p.seat === null && <span className="ml-2 text-[11px] text-cream/30">観戦</span>}
              </span>
              {p.is_cpu && <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-bold text-cream/55 ring-1 ring-white/10">CPU</span>}
              {p.is_cpu && isHost && (
                <button disabled={busy} onClick={() => void run('remove_cpu', { playerId: p.id })} className="px-2 py-2 text-sm text-muted">
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <button
            disabled={busy || seated.length >= 12}
            onClick={() => void run('add_cpu')}
            className="mt-3 w-full rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-cream/60 disabled:opacity-40"
          >
            ＋ CPU を追加
          </button>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <SectionTitle>手番の制限時間</SectionTitle>
          <div className="flex gap-2">
            {TURN_OPTIONS.map((o) => (
              <Chip key={String(o.value)} active={room.settings.turnSeconds === o.value} disabled={!isHost || busy} onClick={() => setSettings({ turnSeconds: o.value })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>終了条件</SectionTitle>
          <div className="mb-2 flex gap-2">
            <Chip active={room.settings.endMode === 'points'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'points' })}>
              目標点
            </Chip>
            <Chip active={room.settings.endMode === 'rounds'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'rounds' })}>
              ラウンド数
            </Chip>
          </div>
          <div className="flex gap-2">
            {(room.settings.endMode === 'points' ? POINT_TARGETS : ROUND_TARGETS).map((t) => (
              <Chip key={t} active={room.settings.target === t} disabled={!isHost || busy} onClick={() => setSettings({ target: t })}>
                {t}
                {room.settings.endMode === 'points' ? '点' : 'R'}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-auto pt-2">
        {isHost ? (
          <button
            disabled={busy || seated.length < 2}
            onClick={() => void run('start')}
            className="gold-foil w-full rounded-2xl py-4 font-display text-lg font-extrabold text-[#3a2a06] shadow-[0_14px_36px_-14px_rgba(242,193,78,.85)] transition active:scale-[.98] disabled:opacity-40"
          >
            ゲーム開始（{seated.length}人）
          </button>
        ) : (
          <p className="text-center text-muted">ホストの開始を待っています…</p>
        )}
        {error && <p className="mt-2 text-center text-sm text-rose">{error}</p>}
      </div>
    </div>
  );
}
