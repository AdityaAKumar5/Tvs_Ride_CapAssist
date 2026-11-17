import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FAMILY_COLOR } from '../styles/theme';

export interface DutyRow { key: string; name: string; wh: number | null; pulses: number | null; family: string; }

/** Energy the 12 V battery supplies in one pass, with the number of high-current pulses printed on each bar. */
export function BatteryDutyChart({ rows, height }: { rows: DutyRow[]; height?: number }) {
  const data = rows.map((r) => ({ ...r, whPlot: r.wh ?? 0, tag: r.wh === null ? 'N/A' : `${r.wh.toFixed(1)} Wh · ${r.pulses ?? 0} pulse${r.pulses === 1 ? '' : 's'}` }));
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(200, rows.length * 30 + 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 128, bottom: 16, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--line)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} label={{ value: '12 V battery energy output, Wh per 600 s', position: 'insideBottom', offset: -6, fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: 'var(--ink)' }} tickLine={false} interval={0} />
        <Tooltip cursor={{ fill: 'rgba(36,116,210,0.06)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 12 }}
          formatter={(v: number) => [`${v.toFixed(2)} Wh`, 'Battery output']} />
        <Bar dataKey="whPlot" isAnimationActive={false} radius={[0, 3, 3, 0]}>
          {data.map((r) => <Cell key={r.key} fill={FAMILY_COLOR[r.family] ?? '#64748B'} />)}
          <LabelList dataKey="tag" content={(p) => {
            const q = p as { x?: number; y?: number; width?: number; height?: number; value?: string };
            return <text x={(q.x ?? 0) + (q.width ?? 0) + 6} y={(q.y ?? 0) + (q.height ?? 0) / 2 + 4} fontSize="11" fill="var(--ink)" className="num">{q.value}</text>;
          }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
