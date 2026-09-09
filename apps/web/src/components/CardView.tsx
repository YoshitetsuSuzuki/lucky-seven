import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Card } from '@lucky7/engine';
import { useTheme } from '../lib/theme';
import type { CardBackStyle, Theme } from '../lib/theme';

export const ACTION_LABEL: Record<string, string> = { freeze: '氷結', triple: '三連', insurance: '保険' };

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

/** 角の丸み。テーマごとに `--card-round`（幅に対する比）で決まる */
const radius = (w: number) => `calc(var(--card-round) * ${w}px)`;

/* ---------- アイコン（色は面から継承する） ---------- */

function Snowflake({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.95">
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
      <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
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
      <path d="M12 2.4l7.2 2.7v6.1c0 4.5-3.1 8.4-7.2 10.4-4.1-2-7.2-5.9-7.2-10.4V5.1z" fill="currentColor" opacity="0.96" />
      <path
        d="M8.5 12.1l2.6 2.6 4.6-4.9"
        stroke="var(--act-insurance-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- 裏面（テーマごとの模様） ---------- */

/** ピクセルの「7」（アーケード用） */
const PIXEL_SEVEN = ['11111', '00001', '00010', '00100', '00100', '01000', '01000'];

function BackPattern({ back, uid }: { back: CardBackStyle; uid: string }) {
  const p = `p${uid}`;
  switch (back.pattern) {
    // 青海波：重なり合う半円
    case 'seigaiha':
      return (
        <>
          <defs>
            <pattern id={p} width="8" height="4" patternUnits="userSpaceOnUse">
              {[-8, 0, 8].map((dx) => (
                <g key={dx} transform={`translate(${dx} 0)`} fill="none" stroke={back.ink} strokeWidth="0.5">
                  <path d="M0 4 A4 4 0 0 1 8 4" opacity="0.55" />
                  <path d="M1.3 4 A2.7 2.7 0 0 1 6.7 4" opacity="0.4" />
                  <path d="M2.6 4 A1.4 1.4 0 0 1 5.4 4" opacity="0.28" />
                </g>
              ))}
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${p})`} />
        </>
      );
    // キャンディ：斜めのストライプに水玉
    case 'candy':
      return (
        <>
          <defs>
            <pattern id={p} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="3.4" height="7" fill={back.ink} fillOpacity="0.34" />
              <circle cx="5.2" cy="3.5" r="1.15" fill={back.ink} fillOpacity="0.5" />
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${p})`} />
        </>
      );
    // アーケード：スキャンライン＋ドット絵の 7
    case 'arcade':
      return (
        <>
          <defs>
            <pattern id={p} width="4" height="3" patternUnits="userSpaceOnUse">
              <rect width="4" height="1" fill={back.ink} fillOpacity="0.16" />
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${p})`} />
          <g transform="translate(13.5 19)">
            {PIXEL_SEVEN.map((row, y) =>
              row.split('').map((c, x) =>
                c === '1' ? (
                  <rect key={`${x}-${y}`} x={x * 2.6} y={y * 2.6} width="2.2" height="2.2" fill={back.ink} fillOpacity="0.85" />
                ) : null,
              ),
            )}
          </g>
        </>
      );
    // ギンガムチェック
    case 'gingham':
      return (
        <>
          <defs>
            <pattern id={p} width="9" height="9" patternUnits="userSpaceOnUse">
              <rect width="4.5" height="9" fill={back.ink} fillOpacity="0.22" />
              <rect width="9" height="4.5" fill={back.ink} fillOpacity="0.22" />
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${p})`} />
        </>
      );
    // サロン：斜めに散らした「7」
    default:
      return (
        <>
          <defs>
            <pattern id={p} width="9" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
              <text
                x="4.5"
                y="9"
                textAnchor="middle"
                fontSize="8"
                fontWeight="800"
                fontFamily="Bricolage Grotesque, Georgia, serif"
                fill={back.ink}
                fillOpacity="0.2"
              >
                7
              </text>
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${p})`} />
        </>
      );
  }
}

export function CardBack({
  size = 'md',
  className = '',
  style,
  theme,
}: {
  size?: CardSize;
  className?: string;
  style?: CSSProperties;
  /** テーマ見本などで、いま選ばれていないテーマの裏面を描くとき */
  theme?: Theme;
}) {
  const current = useTheme();
  const back = (theme ?? current).back;
  const d = CARD_DIMS[size];
  const uid = useId().replace(/:/g, '');
  return (
    <div
      /* position は指定しない：呼び出し側が absolute を渡せるようにするため */
      className={`shrink-0 overflow-hidden ${className}`}
      style={{
        width: d.w,
        height: d.h,
        borderRadius: radius(d.w),
        boxShadow: 'var(--card-shadow)',
        ...style,
      }}
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox="0 0 40 56" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={back.bg[0]} />
            <stop offset="100%" stopColor={back.bg[1]} />
          </linearGradient>
        </defs>
        <rect width="40" height="56" fill={`url(#g${uid})`} />
        <BackPattern back={back} uid={uid} />
        <rect x="2.4" y="2.4" width="35.2" height="51.2" rx="3.4" fill="none" stroke={back.frame} strokeOpacity="0.5" strokeWidth="0.9" />
        <rect x="4.4" y="4.4" width="31.2" height="47.2" rx="2.4" fill="none" stroke={back.frameSoft} strokeOpacity="0.16" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/* ---------- 表面 ---------- */

function Face({ card, d }: { card: Card; d: { w: number; h: number } }) {
  const inner = `calc(var(--card-round) * ${d.w}px - 2px)`;

  if (card.kind === 'number') {
    const v = card.value;
    return (
      <div
        className="card-face absolute inset-[2px] overflow-hidden"
        data-seven={v === 7 ? '1' : undefined}
        style={
          {
            borderRadius: inner,
            // 1枚ごとの地色と文字色。CSS 側（テーマ）がこの2つを使って縁や光り方を決める
            '--n': `var(--num-${v})`,
            '--ni': `var(--num-${v}-ink)`,
          } as CSSProperties
        }
      >
        <div className="absolute inset-0 card-sheen" />
        <span
          className="card-num absolute font-display font-extrabold leading-none opacity-80"
          style={{ top: '5%', left: '9%', fontSize: Math.round(d.h * 0.17) }}
        >
          {v}
        </span>
        <span
          className="card-num absolute inset-0 flex items-center justify-center font-display font-extrabold leading-none"
          style={{ fontSize: Math.round(d.h * 0.5) }}
        >
          {v}
        </span>
        <span
          className="card-num absolute font-display font-extrabold leading-none opacity-80"
          style={{ bottom: '5%', right: '9%', fontSize: Math.round(d.h * 0.17), transform: 'rotate(180deg)' }}
        >
          {v}
        </span>
      </div>
    );
  }

  if (card.kind === 'action') {
    const icon = Math.round(d.h * 0.42);
    return (
      <div
        className="card-act absolute inset-[2px] flex flex-col items-center justify-center overflow-hidden"
        style={
          {
            borderRadius: inner,
            '--act-bg': `var(--act-${card.action}-bg)`,
            '--act-ink': `var(--act-${card.action}-ink)`,
            '--act-ring': `var(--act-${card.action}-ring)`,
          } as CSSProperties
        }
      >
        <div className="absolute inset-0 card-sheen" />
        <div className="relative -mt-[6%] drop-shadow-[0_2px_4px_rgba(0,0,0,.28)]">
          {card.action === 'freeze' && <Snowflake size={icon} />}
          {card.action === 'triple' && <Chevrons size={icon} />}
          {card.action === 'insurance' && <Shield size={icon} />}
        </div>
        <span
          className="absolute font-jp font-bold"
          style={{ bottom: '6%', fontSize: Math.max(8, Math.round(d.h * 0.15)), letterSpacing: '0.06em' }}
        >
          {ACTION_LABEL[card.action]}
        </span>
      </div>
    );
  }

  // 修飾カード（テーマの「金箔」）
  return (
    <div
      className="gold-foil absolute inset-[2px] flex items-center justify-center overflow-hidden"
      style={{ borderRadius: inner, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)' }}
    >
      <div className="absolute inset-0 card-sheen opacity-70" />
      <span
        className="relative font-display font-extrabold leading-none"
        style={{ fontSize: Math.round(d.h * (card.kind === 'mul' ? 0.3 : 0.33)) }}
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
  return (
    <div
      {...(track ? { 'data-card-id': card.id } : {})}
      className={`relative shrink-0 card-shell ${animate ? 'animate-pop' : ''} ${className}`}
      style={{
        width: d.w,
        height: d.h,
        borderRadius: radius(d.w),
        visibility: hidden ? 'hidden' : undefined,
        ...(marked ? { boxShadow: '0 0 0 2px rgb(var(--rose-rgb)), 0 6px 16px -6px rgba(0,0,0,.6)' } : null),
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
