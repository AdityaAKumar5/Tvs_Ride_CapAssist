import { motion } from 'framer-motion';
import { nominalProfile } from '../utils/calc';

/** Nominal electrical power profile of an assist mode, from the design specification. Not a measured waveform. */
export function BoostProfile({ mode, color }: { mode: 'eco' | 'power'; color: string }) {
  const pts = nominalProfile(mode);
  const W = 320; const H = 156; const pl = 40; const pb = 24; const pt = 18; const pr = 10;
  const x = (t: number) => pl + (t / 9) * (W - pl - pr);
  const y = (w: number) => pt + (1 - w / 500) * (H - pt - pb);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.w).toFixed(1)}`).join('');
  const end = mode === 'eco' ? 4 : 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Nominal ${mode} boost power profile`}>
      {[0, 250, 500].map((w) => (<g key={w}><line x1={pl} x2={W - pr} y1={y(w)} y2={y(w)} stroke="var(--line)" /><text x={pl - 5} y={y(w) + 3} fontSize="9" textAnchor="end" fill="var(--muted)" className="num">{w}</text></g>))}
      {[0, 2, 4, 6, 8].map((t) => <text key={t} x={x(t)} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--muted)" className="num">{t} s</text>)}
      <text x={W - pr} y={10} fontSize="9" textAnchor="end" fill="var(--muted)">W electrical, nominal</text>
      <path d={`${d}L${x(9)} ${y(0)}L${x(0)} ${y(0)}Z`} fill={color} opacity="0.14" />
      <motion.path key={mode} d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.2 }} />
      <line x1={x(end)} x2={x(end)} y1={pt} y2={y(0)} stroke={color} strokeDasharray="3 3" />
      <text x={x(end) + (mode === 'eco' ? 4 : -4)} y={pt + 22} fontSize="9.5" textAnchor={mode === 'eco' ? 'start' : 'end'} fill={color}>ends at {end} s</text>
    </svg>
  );
}
