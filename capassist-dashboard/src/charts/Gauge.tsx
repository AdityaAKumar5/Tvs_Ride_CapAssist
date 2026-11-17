import { memo } from 'react';

interface Mark { v: number; color: string; label: string; }
interface Props {
  value: number | null;
  min: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  digits?: number;
  marks?: Mark[];
  naText?: string;
  size?: number;
}

const A0 = -220; const A1 = 40; // sweep of the dial in degrees (0 = east, clockwise positive)

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0); const [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Digital automotive-style dial in SVG. It shows a logged value, or says plainly that there is none. */
function GaugeBase({ value, min, max, label, unit, color, digits = 0, marks = [], naText, size = 170 }: Props) {
  const cx = 100; const cy = 100; const r = 78;
  const f = value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  const ang = (v: number) => A0 + ((v - min) / (max - min)) * (A1 - A0);
  const ticks = Array.from({ length: 11 }, (_, k) => min + ((max - min) * k) / 10);
  return (
    <svg viewBox="0 0 200 170" width={size} height={(size * 170) / 200} role="img" aria-label={`${label}: ${value === null ? 'not available' : value.toFixed(digits) + ' ' + unit}`}>
      <path d={arc(cx, cy, r, A0, A1)} fill="none" stroke="var(--line)" strokeWidth="11" strokeLinecap="round" />
      {value !== null && f > 0.002 && <path d={arc(cx, cy, r, A0, A0 + f * (A1 - A0))} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />}
      {ticks.map((t, k) => {
        const [x0, y0] = polar(cx, cy, r - 12, ang(t)); const [x1, y1] = polar(cx, cy, r - (k % 5 === 0 ? 21 : 17), ang(t));
        return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--muted)" strokeWidth={k % 5 === 0 ? 1.6 : 0.9} />;
      })}
      {[min, (min + max) / 2, max].map((t) => { const [x, y] = polar(cx, cy, r - 31, ang(t)); return <text key={t} x={x} y={y + 3} fontSize="9" textAnchor="middle" fill="var(--muted)" className="num">{Math.round(t)}</text>; })}
      {marks.filter((m) => m.v >= min && m.v <= max).map((m) => {
        const [x0, y0] = polar(cx, cy, r + 8, ang(m.v)); const [x1, y1] = polar(cx, cy, r - 8, ang(m.v));
        return <g key={m.label}><line x1={x0} y1={y0} x2={x1} y2={y1} stroke={m.color} strokeWidth="2.5" /><title>{`${m.label}: ${m.v} ${unit}`}</title></g>;
      })}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={value === null ? 15 : 34} fontWeight="600" fill="var(--head)" fontFamily="Rajdhani, Inter, sans-serif" className="num">
        {value === null ? (naText ?? 'N/A') : value.toFixed(digits)}
      </text>
      {value !== null && <text x={cx} y={cy + 24} textAnchor="middle" fontSize="11" fill="var(--muted)">{unit}</text>}
      <text x={cx} y={160} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--head)" fontFamily="Rajdhani, Inter, sans-serif" letterSpacing="0.06em">{label.toUpperCase()}</text>
    </svg>
  );
}

export const Gauge = memo(GaugeBase);
