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
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} stroke="#334155" strokeWidth="4" fill="none" />
      <circle cx="18" cy="18" r={r} stroke={remain <= 5 ? '#f43f5e' : '#fbbf24'} strokeWidth="4" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="11" fill="#e2e8f0" fontWeight="700">{remain}</text>
    </svg>
  );
}
