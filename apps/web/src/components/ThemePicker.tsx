import type { CSSProperties, ReactNode } from 'react';
import type { Card } from '@lucky7/engine';
import { playSfx } from '../lib/audio';
import { numberVars, setTheme, THEMES, useTheme } from '../lib/theme';
import type { Theme, ThemeId } from '../lib/theme';
import CardView, { CardBack } from './CardView';

/** 見本に使う札（本物の CardView をそのまま並べる） */
const SAMPLE: Card[] = [
  { id: 'th-7', kind: 'number', value: 7 },
  { id: 'th-12', kind: 'number', value: 12 },
  { id: 'th-4', kind: 'number', value: 4 },
  { id: 'th-freeze', kind: 'action', action: 'freeze' },
];

function choose(id: ThemeId) {
  setTheme(id);
  // 切り替わった合図。効果音が切ってあれば鳴らない
  playSfx('reaction', 0.45);
}

/** そのテーマの色でだけ描かれる区画。いまのテーマの中に埋め込める */
function Scope({ theme, className = '', children }: { theme: Theme; className?: string; children: ReactNode }) {
  return (
    <div data-theme={theme.id} className={className} style={numberVars(theme) as CSSProperties}>
      {children}
    </div>
  );
}

/* ---------- 設定・情報の大きな見本 ---------- */

export function ThemeCards() {
  const active = useTheme();
  return (
    <div className="space-y-2.5">
      {THEMES.map((t) => {
        const on = t.id === active.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-pressed={on}
            className={`block w-full overflow-hidden rounded-2xl border text-left transition active:scale-[.99] ${
              on ? 'border-gold/70 shadow-[0_10px_28px_-18px_var(--glow)]' : 'border-edge/12'
            }`}
          >
            <Scope theme={t}>
              {/* 卓と札の見本（そのテーマの色・質感・裏面でそのまま描く） */}
              <div className="felt flex items-end gap-1.5 px-3 py-3" style={{ borderRadius: 0, borderWidth: 0 }}>
                {SAMPLE.map((c) => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
                <CardBack size="sm" theme={t} className="ml-auto" style={{ transform: 'rotate(6deg)' }} />
              </div>
            </Scope>
            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${on ? 'bg-gold/10' : 'bg-ink2/70'}`}>
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none ${
                  on ? 'bg-gold text-ink' : 'border border-edge/25'
                }`}
              >
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold text-cream/95">{t.name}</span>
                <span className="block truncate text-[12px] text-muted">{t.tagline}</span>
              </span>
              {on && <span className="ml-auto shrink-0 text-[11px] font-bold text-gold">使用中</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- ホームの小さな見本 ---------- */

function Swatch({ theme, on }: { theme: Theme; on: boolean }) {
  const s = theme.swatch;
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 place-items-center rounded-full transition"
      style={{
        background: `conic-gradient(from 150deg, ${s.felt} 0 42%, ${s.card} 42% 72%, ${s.accent} 72% 100%)`,
        boxShadow: on
          ? '0 0 0 2px rgb(var(--ink-rgb)), 0 0 0 4px rgb(var(--gold-rgb)), 0 6px 16px -8px var(--glow)'
          : '0 0 0 1px rgb(var(--edge-rgb) / 0.25)',
      }}
    >
      <span className="h-4 w-4 rounded-full" style={{ background: s.bg }} />
    </span>
  );
}

export function ThemeSwatches({ className = '' }: { className?: string }) {
  const active = useTheme();
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div className="flex items-center justify-center gap-2.5" role="group" aria-label="見た目のテーマ">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-pressed={t.id === active.id}
            aria-label={`テーマ: ${t.name}`}
            className="grid min-h-[44px] min-w-[44px] place-items-center transition active:scale-90"
          >
            <Swatch theme={t} on={t.id === active.id} />
          </button>
        ))}
      </div>
      <p className="text-[11.5px] font-bold text-muted">
        テーマ: <span className="text-cream/80">{active.name}</span>
      </p>
    </div>
  );
}
