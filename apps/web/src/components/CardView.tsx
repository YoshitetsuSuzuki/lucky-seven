import type { Card } from '@lucky7/engine';

export const ACTION_LABEL: Record<string, string> = { freeze: '氷結', triple: '三連', insurance: '保険' };

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'add') return `+${card.value}`;
  if (card.kind === 'mul') return '×2';
  return ACTION_LABEL[card.action];
}

export default function CardView({ card, small = false, animate = false }: { card: Card; small?: boolean; animate?: boolean }) {
  const base = small ? 'h-10 w-7 text-sm' : 'h-14 w-10 text-lg';
  const color =
    card.kind === 'number' ? 'bg-slate-100 text-slate-900'
    : card.kind === 'action' ? 'bg-sky-500 text-white'
    : 'bg-amber-400 text-slate-900';
  return (
    <div className={`${base} ${color} ${animate ? 'animate-pop' : ''} rounded-md flex items-center justify-center font-black shadow`}>
      {cardLabel(card)}
    </div>
  );
}
