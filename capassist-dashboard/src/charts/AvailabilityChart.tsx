import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { availability } from '../utils/calc';
import { SIGNAL } from '../styles/theme';

export interface AvailRow {
  key: string; name: string; full: number; cutShort: number; denied: number; engineCold: number; requests: number;
  profile: string | null; selected?: boolean;
}

const PROFILE: Record<string, string> = { sustained_8s: 'sustained 8 s boost', tapered_3s_1s: 'tapered 3+1 s boost' };

/** Stacked bars of what happened to every boost request. The denominator is printed beside each system. */
export function AvailabilityChart({ rows, height, onSelect }: { rows: AvailRow[]; height?: number; onSelect?: (key: string) => void }) {
  const h = height ?? Math.max(220, rows.length * 44 + 50);
  const maxReq = Math.max(1, ...rows.map((r) => r.requests));
  const Tick = (p: { x?: number; y?: number; payload?: { value: string } }) => {
    const r = rows.find((x) => x.key === p.payload?.value);
    if (!r) return null;
    const a = availability(r.full, r.requests);
    return (
      <g transform={`translate(${p.x},${p.y})`} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(r.key)}>
        <text x={-8} y={-3} textAnchor="end" fontSize="12" fontWeight={r.selected ? 700 : 500} fill={r.selected ? '#E11B22' : 'var(--ink)'}>{r.name}</text>
        <text x={-8} y={11} textAnchor="end" fontSize="10.5" fill="var(--muted)" className="num">
          {a === null ? 'no electric assist: N/A' : `${r.full}/${r.requests} full · ${a.toFixed(0)}%${r.profile ? ' · ' + PROFILE[r.profile] : ''}`}
        </text>
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 24, bottom: 18, left: 8 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="var(--line)" />
        <XAxis type="number" domain={[0, maxReq]} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }}
          label={{ value: 'Boost requests in the 600 s cycle', position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="category" dataKey="key" width={292} tick={<Tick />} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={0} />
        <Tooltip cursor={{ fill: 'rgba(36,116,210,0.06)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 12 }}
          labelFormatter={(k) => rows.find((r) => r.key === k)?.name ?? String(k)} />
        <Bar dataKey="full" name="Full boosts" stackId="a" fill={SIGNAL.full} isAnimationActive={false} />
        <Bar dataKey="cutShort" name="Cut short" stackId="a" fill={SIGNAL.partial} isAnimationActive={false} />
        <Bar dataKey="denied" name="Denied (energy store)" stackId="a" fill={SIGNAL.denied} isAnimationActive={false} />
        <Bar dataKey="engineCold" name="Refused: engine cold" stackId="a" fill={SIGNAL.cold} isAnimationActive={false} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AvailabilityLegend() {
  const items: [string, string][] = [[SIGNAL.full, 'Full boost'], [SIGNAL.partial, 'Cut short'], [SIGNAL.denied, 'Denied by the energy store'], [SIGNAL.cold, 'Refused: engine cold']];
  return <span className="flex flex-wrap gap-3 text-[11px] text-muted">{items.map(([c, l]) => <span key={l} className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />{l}</span>)}</span>;
}
