import { useLayoutEffect, useRef } from 'react';
import CardView, { CardBack } from './CardView';
import type { Flight } from '../hooks/useCardFlights';

function FlyingCard({ flight, start }: { flight: Flight; start: (f: Flight, wrap: HTMLElement, inner: HTMLElement) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (wrap.current && inner.current) start(flight, wrap.current, inner.current);
  }, [flight, start]);
  return (
    <div
      ref={wrap}
      className="pointer-events-none fixed z-[60]"
      style={{
        left: flight.from.left,
        top: flight.from.top,
        width: flight.from.width,
        height: flight.from.height,
        transformOrigin: 'top left',
        perspective: '760px',
        willChange: 'transform',
      }}
      aria-hidden
    >
      <div ref={inner} className="relative h-full w-full flip-3d">
        <div className="absolute inset-0 flip-face">
          <CardBack size="md" />
        </div>
        <div className="absolute inset-0 flip-face" style={{ transform: 'rotateY(180deg)' }}>
          <CardView card={flight.card} size="md" />
        </div>
      </div>
    </div>
  );
}

export default function FlyingCards({
  flights,
  start,
}: {
  flights: Flight[];
  start: (f: Flight, wrap: HTMLElement, inner: HTMLElement) => void;
}) {
  if (flights.length === 0) return null;
  return (
    <>
      {flights.map((f) => (
        <FlyingCard key={f.key} flight={f} start={start} />
      ))}
    </>
  );
}
