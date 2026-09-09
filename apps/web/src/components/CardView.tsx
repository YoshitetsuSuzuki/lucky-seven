import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Card } from '@lucky7/engine';

export const ACTION_LABEL: Record<string, string> = { freeze: '氷結', triple: '三連', insurance: '保険' };

/** 数字ごとの固有色（実物のカードのように、手札が一目で読めるように） */
export const NUMBER_COLORS: Record<number, string> = {
  0: '#5b6470',
  1: '#c0392b',
  2: '#e67e22',
  3: '#d4a017',
  4: '#7cb518',
  5: '#1e8f5a',
  6: '#159a9c',
  7: '#2a7de1',
  8: '#4b4bd6',
  9: '#7d3cd6',
  10: '#b8338f',
  11: '#d6457a',
  12: '#8b1a1a',
};

const ACTION_FACE: Record<string, { bg: string; ink: string }> = {
  freeze: { bg: 'linear-gradient(158deg,#bfe9f8 0%,#6bc0dd 46%,#3d92b4 100%)', ink: '#0b3348' },
  triple: { bg: 'linear-gradient(158deg,#ffc861 0%,#f0902c 48%,#d2661a 100%)', ink: '#4a2405' },
  insurance: { bg: 'linear-gradient(158deg,#63d9a0 0%,#28a771 48%,#12724c 100%)', ink: '#053d28' },
};

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'add') return `+${card.value}`;
  if (card.kind === 'mul') return '×2';
  return ACTION_LABEL[card.action];
}

export type CardSize = 'sm' | 'md' | 'lg';
/** 5:7 のアスペクト比 */
export const CARD_DIMS: Record<CardSize, { w: number; h: number }> = {
  sm: { w: 44, h: 62 },
  md: { w: 56, h: 78 },
  lg: { w: 80, h: 112 },
};

/* ---------- アイコン ---------- */

function Snowflake({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#fff" strokeWidth="1.7" strokeLinecap="round" opacity="0.95">
        {[0, 60, 120].map((a) => (
          <g key={a} transform={`rotate(${a} 12 12)`}>
            <line x1="12" y1="2.6" x2="12" y2="21.4" />
            <line x1="12" y1="6.4" x2="9" y2="4.1" />
            <line x1="12" y1="6.4" x2="15" y2="4.1" />
            <line x1="12" y1="17.6" x2="9" y2="19.9" />
            <line x1="12" y1="17.6" x2="15" y2="19.9" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Chevrons({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4.5,5 12,11 19.5,5" />
        <polyline points="4.5,11 12,17 19.5,11" opacity="0.75" />
        <polyline points="4.5,17 12,23 19.5,17" opacity="0.5" />
      </g>
    </svg>
  );
}

function Shield({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2.4l7.2 2.7v6.1c0 4.5-3.1 8.4-7.2 10.4-4.1-2-7.2-5.9-7.2-10.4V5.1z" fill="#fff" opacity="0.96" />
      <path d="M8.5 12.1l2.6 2.6 4.6-4.9" stroke="#12724c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- 裏面 ---------- */

export function CardBack({ size = 'md', className = '', style }: { size?: CardSize; className?: string; style?: CSSProperties }) {
  const d = CARD_DIMS[size];
  const uid = useId().replace(/:/g, '');
  const r = Math.round(d.w * 0.15);
  return (
    <div
      /* position は指定しない：呼び出し側が absolute を渡せるようにするため */
      className={`shrink-0 overflow-hidden ${className}`}
      style={{ width: d.w, height: d.h, borderRadius: r, boxShadow: '0 1px 2px rgba(0,0,0,.6), 0 8px 18px -8px rgba(0,0,0,.8)', ...style }}
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox="0 0 40 56" preserveAspectRatio="none">
        <defs>
          <pattern id={`p${uid}`} width="9" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <text x="4.5" y="9" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="Bricolage Grotesque, Georgia, serif" fill="#f2c14e" fillOpacity="0.2">
              7
            </text>
          </pattern>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1b2647" />
            <stop offset="100%" stopColor="#0c1226" />
          </linearGradient>
        </defs>
        <rect width="40" height="56" fill={`url(#g${uid})`} />
        <rect width="40" height="56" fill={`url(#p${uid})`} />
        <rect x="2.4" y="2.4" width="35.2" height="51.2" rx="3.4" fill="none" stroke="#f2c14e" strokeOpacity="0.5" strokeWidth="0.9" />
        <rect x="4.4" y="4.4" width="31.2" height="47.2" rx="2.4" fill="none" stroke="#f2c14e" strokeOpacity="0.16" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/* ---------- 表面 ---------- */

function Face({ card, d }: { card: Card; d: { w: number; h: number } }) {
  const inner = Math.round(d.w * 0.15) - 2;

  if (card.kind === 'number') {
    const bg = NUMBER_COLORS[card.value] ?? '#5b6470';
    const isSeven = card.value === 7;
    return (
      <div
        className="absolute inset-[2px] overflow-hidden"
        style={{
          borderRadius: Math.max(3, inner),
          background: bg,
          boxShadow: isSeven ? 'inset 0 0 0 1.5px rgba(242,193,78,.95)' : 'inset 0 0 0 1px rgba(0,0,0,.18)',
        }}
      >
        <div className="absolute inset-0 card-sheen" />
        <span
          className="absolute font-display font-extrabold leading-none text-white/85"
          style={{ top: '5%', left: '9%', fontSize: Math.round(d.h * 0.17) }}
        >
          {card.value}
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center font-display font-extrabold leading-none text-white"
          style={{ fontSize: Math.round(d.h * 0.5), textShadow: '0 2px 6px rgba(0,0,0,.32)' }}
        >
          {card.value}
        </span>
        <span
          className="absolute font-display font-extrabold leading-none text-white/85"
          style={{ bottom: '5%', right: '9%', fontSize: Math.round(d.h * 0.17), transform: 'rotate(180deg)' }}
        >
          {card.value}
        </span>
      </div>
    );
  }

  if (card.kind === 'action') {
    const f = ACTION_FACE[card.action];
    const icon = Math.round(d.h * 0.42);
    return (
      <div
        className="absolute inset-[2px] flex flex-col items-center justify-center overflow-hidden"
        style={{ borderRadius: Math.max(3, inner), background: f.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.16)' }}
      >
        <div className="absolute inset-0 card-sheen" />
        <div className="relative -mt-[6%] drop-shadow-[0_2px_4px_rgba(0,0,0,.28)]">
          {card.action === 'freeze' && <Snowflake size={icon} />}
          {card.action === 'triple' && <Chevrons size={icon} />}
          {card.action === 'insurance' && <Shield size={icon} />}
        </div>
        <span
          className="absolute font-jp font-bold text-white"
          style={{ bottom: '6%', fontSize: Math.max(8, Math.round(d.h * 0.15)), letterSpacing: '0.06em', textShadow: '0 1px 3px rgba(0,0,0,.4)' }}
        >
          {ACTION_LABEL[card.action]}
        </span>
      </div>
    );
  }

  // 修飾カード（金箔）
  return (
    <div
      className="absolute inset-[2px] flex items-center justify-center overflow-hidden gold-foil"
      style={{ borderRadius: Math.max(3, inner), boxShadow: 'inset 0 0 0 1px rgba(90,60,10,.35)' }}
    >
      <div className="absolute inset-0 card-sheen opacity-70" />
      <span
        className="relative font-display font-extrabold leading-none"
        style={{ fontSize: Math.round(d.h * (card.kind === 'mul' ? 0.3 : 0.33)), color: '#3a2a06' }}
      >
        {card.kind === 'add' ? `+${card.value}` : '×2'}
      </span>
    </div>
  );
}

/* ---------- 本体 ---------- */

export default function CardView({
  card,
  size = 'sm',
  animate = false,
  hidden = false,
  marked = false,
  track = false,
  className = '',
  style,
}: {
  card: Card;
  size?: CardSize;
  /** 出現アニメーション */
  animate?: boolean;
  /** 飛行中は実体を隠す */
  hidden?: boolean;
  /** バーストの原因になった1枚（赤リング＋✕） */
  marked?: boolean;
  /** 飛行先の特定用に data-card-id を付ける（手札のみ） */
  track?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const d = CARD_DIMS[size];
  const r = Math.round(d.w * 0.15);
  return (
    <div
      {...(track ? { 'data-card-id': card.id } : {})}
      className={`relative shrink-0 card-shell ${animate ? 'animate-pop' : ''} ${className}`}
      style={{
        width: d.w,
        height: d.h,
        borderRadius: r,
        visibility: hidden ? 'hidden' : undefined,
        ...(marked ? { boxShadow: '0 0 0 2px var(--rose), 0 6px 16px -6px rgba(0,0,0,.6)' } : null),
        ...style,
      }}
      aria-label={cardLabel(card)}
    >
      <Face card={card} d={d} />
      {marked && (
        <span
          className="absolute -right-1 -top-1 z-10 grid place-items-center rounded-full bg-rose font-bold text-white"
          style={{ width: 15, height: 15, fontSize: 10, lineHeight: 1 }}
          title="バーストの原因"
        >
          ✕
        </span>
      )}
    </div>
  );
}
