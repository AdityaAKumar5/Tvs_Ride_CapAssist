import { memo, useEffect, useMemo, useRef } from 'react';
import type { BoostEvent } from '../types';
import { useWidth } from '../hooks/useSize';
import { useReplay, useReplaySecond } from '../hooks/useReplay';
import { OUTCOME_COLOR, OUTCOME_LABEL } from '../styles/theme';

const PAD = { l: 46, r: 12, t: 18, b: 18 };

export interface RefLine { y: number; label: string; color?: string; }

interface Props {
  t: number[];                       // time of each sample on the replay axis
  values: (number | null)[];
  range: [number, number];           // visible window on the replay axis
  label: string;
  unit: string;
  color: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  stepped?: boolean;                 // on/off signals
  fill?: boolean;
  events?: BoostEvent[];             // boost markers along the top
  shade?: number[];                  // 1 where a band should be shaded (engine off)
  refLines?: RefLine[];
  divider?: { t: number; label: string };
  naText?: string;                   // shown when the signal does not exist for this system
  digits?: number;
}

/** A time-series strip drawn in plain SVG. The path is memoised; only the cursor moves while replaying. */
function TimeStripBase(p: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = p.height ?? 92;
  const [t0, t1] = p.range;
  const first = p.t[0] ?? 1;
  const i0 = Math.max(0, t0 - first); const i1 = Math.min(p.values.length - 1, t1 - first);
  const plotW = Math.max(10, w - PAD.l - PAD.r); const plotH = h - PAD.t - PAD.b;
  const x = (tt: number) => PAD.l + ((tt - t0) / Math.max(1, t1 - t0)) * plotW;

  const { d, area, lo, hi, allNull } = useMemo(() => {
    let lo = p.yMin ?? Infinity; let hi = p.yMax ?? -Infinity; let any = false;
    for (let i = i0; i <= i1; i++) {
      const v = p.values[i];
      if (v === null || v === undefined) continue;
      any = true;
      if (p.yMin === undefined && v < lo) lo = v;
      if (p.yMax === undefined && v > hi) hi = v;
    }
    if (!any) return { d: '', area: '', lo: 0, hi: 1, allNull: true };
    if (hi - lo < 1e-9) { hi = lo + 1; }
    if (p.yMin === undefined) lo = lo - (hi - lo) * 0.06;
    if (p.yMax === undefined) hi = hi + (hi - lo) * 0.06;
    const y = (v: number) => PAD.t + plotH - ((v - lo) / (hi - lo)) * plotH;
    let d = ''; let area = ''; let pen = false; let startX = 0; let lastX = 0; let prevY = 0;
    for (let i = i0; i <= i1; i++) {
      const v = p.values[i];
      if (v === null || v === undefined) { if (pen) { area += `L${lastX.toFixed(1)} ${(PAD.t + plotH).toFixed(1)}L${startX.toFixed(1)} ${(PAD.t + plotH).toFixed(1)}Z`; } pen = false; continue; }
      const px = x(p.t[i]); const py = y(Math.min(hi, Math.max(lo, v)));
      if (!pen) { d += `M${px.toFixed(1)} ${py.toFixed(1)}`; area += `M${px.toFixed(1)} ${py.toFixed(1)}`; startX = px; pen = true; }
      else if (p.stepped) { d += `H${px.toFixed(1)}V${py.toFixed(1)}`; area += `H${px.toFixed(1)}V${py.toFixed(1)}`; }
      else { d += `L${px.toFixed(1)} ${py.toFixed(1)}`; area += `L${px.toFixed(1)} ${py.toFixed(1)}`; }
      lastX = px; prevY = py;
    }
    void prevY;
    if (pen) area += `L${lastX.toFixed(1)} ${(PAD.t + plotH).toFixed(1)}L${startX.toFixed(1)} ${(PAD.t + plotH).toFixed(1)}Z`;
    return { d, area, lo, hi, allNull: false };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.values, p.t, i0, i1, w, h, p.yMin, p.yMax, p.stepped, t0, t1]);

  const yOf = (v: number) => PAD.t + plotH - ((v - lo) / (hi - lo)) * plotH;

  const bands = useMemo(() => {
    if (!p.shade) return [] as [number, number][];
    const out: [number, number][] = []; let s = -1;
    for (let i = i0; i <= i1; i++) {
      const on = p.shade[i] === 1;
      if (on && s < 0) s = p.t[i];
      if ((!on || i === i1) && s >= 0) { out.push([s, p.t[i]]); s = -1; }
    }
    return out;
  }, [p.shade, p.t, i0, i1]);

  const tickStep = t1 - t0 > 700 ? 200 : t1 - t0 > 300 ? 100 : 50;
  const ticks: number[] = [];
  for (let k = Math.ceil((t0 - 1) / tickStep) * tickStep; k <= t1; k += tickStep) ticks.push(k);

  // cursor: moved directly in the DOM on every frame, without re-rendering the chart
  const cursor = useRef<SVGLineElement>(null);
  useEffect(() => {
    const place = (t: number) => { const el = cursor.current; if (!el) return; const px = x(t).toFixed(1); el.setAttribute('x1', px); el.setAttribute('x2', px); };
    place(useReplay.getState().t);
    return useReplay.subscribe((s) => place(s.t));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, t0, t1]);

  const scrub = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return;
    const box = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - box.left - PAD.l) / plotW;
    useReplay.getState().seek(t0 + Math.min(1, Math.max(0, f)) * (t1 - t0));
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} onPointerDown={scrub} onPointerMove={scrub} className="cursor-crosshair touch-none" role="img"
          aria-label={`${p.label} against time`}>
          <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="var(--soft)" opacity="0.55" />
          {bands.map(([a, b], k) => <rect key={k} x={x(a)} y={PAD.t} width={Math.max(1, x(b) - x(a))} height={plotH} fill="#94A3B8" opacity="0.22" />)}
          {ticks.map((k) => (
            <g key={k}>
              <line x1={x(k)} x2={x(k)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--line)" strokeWidth="1" />
              <text x={x(k)} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" className="num">{k}</text>
            </g>
          ))}
          {!allNull && (<>
            <text x={PAD.l - 5} y={PAD.t + 8} textAnchor="end" fontSize="10" fill="var(--muted)" className="num">{hi.toFixed(p.digits ?? 0)}</text>
            <text x={PAD.l - 5} y={PAD.t + plotH} textAnchor="end" fontSize="10" fill="var(--muted)" className="num">{lo.toFixed(p.digits ?? 0)}</text>
            {p.refLines?.filter((r) => r.y >= lo && r.y <= hi).map((r) => (
              <g key={r.label}>
                <line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(r.y)} y2={yOf(r.y)} stroke={r.color ?? 'var(--muted)'} strokeDasharray="4 4" strokeWidth="1" />
                <text x={PAD.l + 5} y={yOf(r.y) - 3} fontSize="10" fill={r.color ?? 'var(--muted)'}>{r.label}</text>
              </g>
            ))}
            {p.fill && <path d={area} fill={p.color} opacity="0.13" />}
            <path d={d} fill="none" stroke={p.color} strokeWidth={h > 150 ? 2 : 1.6} strokeLinejoin="round" />
          </>)}
          {allNull && <text x={PAD.l + plotW / 2} y={PAD.t + plotH / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--muted)">{p.naText ?? 'N/A: signal not in the data for this system'}</text>}
          {p.divider && p.divider.t > t0 && p.divider.t < t1 && (
            <g>
              <line x1={x(p.divider.t)} x2={x(p.divider.t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#E11B22" strokeWidth="1.5" strokeDasharray="6 3" />
              {h > 150 && (<>
                <rect x={x(p.divider.t) - 112} y={PAD.t + plotH - 20} width={224} height={15} rx="3" fill="var(--panel)" stroke="#E11B22" strokeWidth="0.8" />
                <text x={x(p.divider.t)} y={PAD.t + plotH - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="#E11B22">{p.divider.label}</text>
              </>)}
            </g>
          )}
          {p.events && <EventMarkers events={p.events} x={x} top={PAD.t} t0={t0} t1={t1} />}
          <line ref={cursor} y1={PAD.t - 4} y2={PAD.t + plotH + 2} stroke="#E11B22" strokeWidth="1.5" pointerEvents="none" />
          <text x={PAD.l} y={11} fontSize="11" fontWeight="600" fill="var(--head)" fontFamily="Rajdhani, Inter, sans-serif" letterSpacing="0.04em">
            {p.label.toUpperCase()}{p.unit && <tspan fill="var(--muted)" fontWeight="400"> ({p.unit})</tspan>}
          </text>
        </svg>
      )}
      {!allNull && <CursorValue t={p.t} values={p.values} unit={p.unit} digits={p.digits ?? 0} low={Boolean(p.events)} />}
    </div>
  );
}

/** Boost markers. A marker takes its outcome colour only once the replay has reached the end of that boost. */
function EventMarkers({ events, x, top, t0, t1 }: { events: BoostEvent[]; x: (t: number) => number; top: number; t0: number; t1: number }) {
  const sec = useReplaySecond();
  const revealAll = useReplay((s) => s.revealAll);
  return (
    <g>
      {events.filter((e) => e.t >= t0 && e.t <= t1).map((e, k) => {
        const known = revealAll || sec >= e.end;
        const c = known ? OUTCOME_COLOR[e.outcome] : '#94A3B8';
        const px = x(e.t);
        return (
          <g key={k}>
            <line x1={px} x2={px} y1={top} y2={top + 14} stroke={c} strokeWidth="1.5" />
            <path d={`M${px - 5} ${top - 6}L${px + 5} ${top - 6}L${px} ${top + 2}Z`} fill={known ? c : 'var(--panel)'} stroke={c} strokeWidth="1.2" />
            <title>{`${e.t} s: boost request${known ? ' - ' + OUTCOME_LABEL[e.outcome] + (e.wh > 0 ? `, ${e.wh.toFixed(2)} Wh` : '') : ' (outcome not yet known)'}`}</title>
          </g>
        );
      })}
    </g>
  );
}

function CursorValue({ t, values, unit, digits, low }: { t: number[]; values: (number | null)[]; unit: string; digits: number; low?: boolean }) {
  const sec = useReplaySecond();
  const v = values[Math.min(values.length - 1, Math.max(0, sec - (t[0] ?? 1)))];
  return (
    <span className={`absolute right-4 ${low ? 'bottom-6' : 'top-0'} text-[11px] num text-ink bg-panel/85 px-1.5 rounded border border-line`}>
      {v === null || v === undefined ? 'N/A' : `${v.toFixed(digits)} ${unit}`}
    </span>
  );
}

export const TimeStrip = memo(TimeStripBase);
