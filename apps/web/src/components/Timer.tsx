import { useEffect, useState } from 'react';

export default function Timer({ deadline, total }: { deadline: number | null; total: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null || total === null) return null;
  const remain = Math.max(0, Math.ceil((deadline - now) / 1000));
  const ratio = Math.max(0, Math.min(1, (deadline - now) / (total * 1000)));
  const urgent = remain <= 5;
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" className="shrink-0" role="timer" aria-label={`残り${remain}秒`}>
      <circle cx="18" cy="18" r={r} stroke="rgb(var(--cream-rgb) / .14)" strokeWidth="3.5" fill="none" />
      <circle
        cx="18"
        cy="18"
        r={r}
        stroke={urgent ? 'rgb(var(--rose-rgb))' : 'rgb(var(--gold-rgb))'}
        strokeWidth="3.5"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ transition: 'stroke-dashoffset .25s linear' }}
      />
      <text
        x="18"
        y="22.5"
        textAnchor="middle"
        fontSize="13"
        fill={urgent ? 'rgb(var(--rose-rgb))' : 'rgb(var(--cream-rgb))'}
        fontWeight="800"
        fontFamily="var(--font-display)"
      >
        {remain}
      </text>
    </svg>
  );
}
