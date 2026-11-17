import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DataBundle } from '../types';
import { bankCalc, energyCurve, fmt, type BankInputs } from '../utils/calc';
import { Card, Notice, Segmented, StatusBadge } from '../components/ui';
import { SIGNAL } from '../styles/theme';

type Preset = 'new' | 'hot' | 'eol' | 'eolhot';
const BASE: BankInputs = { cells: 10, cellF: 350, vMax: 25, vMin: 12.5, esrMilliOhm: 32, boostW: 432, boostS: 3.5, efficiency: 1, vNow: 19.3 };

/** Documented assumptions for ageing and heat. They are not measured degradation of the selected cells. */
function applyPreset(b: BankInputs, p: Preset): BankInputs {
  const hot = p === 'hot' || p === 'eolhot'; const eol = p === 'eol' || p === 'eolhot';
  const vMax = hot ? Math.min(b.vMax, 2.3 * b.cells) : b.vMax;
  return { ...b, cellF: eol ? b.cellF * 0.8 : b.cellF, esrMilliOhm: eol ? b.esrMilliOhm * 2 : b.esrMilliOhm, vMax, vNow: Math.min(b.vNow, vMax) };
}

const FIELDS: { k: keyof BankInputs; label: string; unit: string; step: number; min: number; max: number }[] = [
  { k: 'cells', label: 'Cells in series', unit: '', step: 1, min: 4, max: 12 },
  { k: 'cellF', label: 'Cell capacitance', unit: 'F', step: 10, min: 50, max: 600 },
  { k: 'vMax', label: 'Maximum voltage', unit: 'V', step: 0.5, min: 13, max: 32 },
  { k: 'vMin', label: 'Minimum voltage', unit: 'V', step: 0.5, min: 6, max: 20 },
  { k: 'esrMilliOhm', label: 'Internal resistance (bank)', unit: 'mΩ', step: 1, min: 1, max: 200 },
  { k: 'boostW', label: 'Assumed boost power', unit: 'W', step: 10, min: 50, max: 800 },
  { k: 'boostS', label: 'Boost duration', unit: 's', step: 0.5, min: 0.5, max: 12 },
  { k: 'efficiency', label: 'Converter efficiency', unit: '', step: 0.01, min: 0.7, max: 1 },
];

export function UcLab({ data }: { data: DataBundle }) {
  const [inp, setInp] = useState<BankInputs>(BASE);
  const [preset, setPreset] = useState<Preset>('new');
  const eff = useMemo(() => applyPreset(inp, preset), [inp, preset]);
  const out = useMemo(() => bankCalc(eff), [eff]);
  const curve = useMemo(() => energyCurve(eff), [eff]);
  const set = (k: keyof BankInputs, v: number) => setInp((s) => ({ ...s, [k]: v }));
  const bank = (cells: number) => { const b = { ...BASE, cells, vMax: 2.5 * cells }; return { b, o: bankCalc(b) }; };
  const ten = bank(10); const eight = bank(8);
  const r10 = data.warm.scenarios.D?.summary; const r8 = data.warm.scenarios.D8?.summary;
  return (
    <div className="grid grid-cols-12 gap-3">
      <Card className="col-span-12 lg:col-span-4" title="Ultracapacitor engineering lab" right={<StatusBadge status="calc" />}>
        <div className="mb-3"><Segmented size="sm" value={preset} onChange={setPreset} options={[{ value: 'new', label: 'New' }, { value: 'hot', label: 'Hot' }, { value: 'eol', label: 'End of life' }, { value: 'eolhot', label: 'EOL + hot' }]} /></div>
        <div className="space-y-1.5">
          {FIELDS.map((f) => (
            <label key={f.k} className="flex items-center justify-between gap-2 text-[13px]">
              <span>{f.label}</span>
              <span className="flex items-center gap-1"><input type="number" value={inp[f.k]} step={f.step} min={f.min} max={f.max}
                onChange={(e) => set(f.k, Math.min(f.max, Math.max(f.min, Number(e.target.value))))} className="w-20 border border-line rounded px-1.5 py-0.5 bg-panel text-right num" />
                <span className="w-7 text-xs text-muted">{f.unit}</span></span>
            </label>))}
          <label className="block text-[13px] pt-1">Present bank voltage: <b className="num">{eff.vNow.toFixed(1)} V</b>
            <input type="range" min={eff.vMin} max={eff.vMax} step={0.1} value={eff.vNow} onChange={(e) => set('vNow', Number(e.target.value))} className="w-full" /></label>
        </div>
        {preset !== 'new' && <p className="text-[11px] text-muted mt-2">Preset applied: {preset.includes('eol') ? 'capacitance −20%, resistance ×2' : ''}{preset === 'eolhot' ? '; ' : ''}{preset.includes('hot') ? 'voltage limit 2.3 V per cell' : ''}. Assumed, not measured on the selected cells.</p>}
      </Card>

      <Card className="col-span-12 lg:col-span-4" title="Results" right={<StatusBadge status="calc" />}>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          {([['Equivalent capacitance', `${fmt(out.ceq, 1)} F`], ['Maximum stored energy', `${fmt(out.eMaxWh, 2)} Wh`], ['Usable energy', `${fmt(out.eUsableWh, 2)} Wh`],
            ['Remaining usable energy', `${fmt(out.eRemainingWh, 2)} Wh`], ['Regen headroom', `${fmt(out.headroomWh, 2)} Wh`], ['Boost energy requirement', `${fmt(out.boostNeedWh, 2)} Wh`],
            ['Discharge current now', out.currentAtNow === null ? 'N/A' : `${fmt(out.currentAtNow, 1)} A`], ['Discharge current at Vmin', `${fmt(out.currentAtMin, 1)} A`],
            ['Resistive loss per boost', out.lossWh === null ? 'N/A' : `${fmt(out.lossWh * 1000, 1)} mWh`], ['Boosts from this voltage', fmt(out.boostsFromNow, 1)]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="rounded-md border border-line bg-soft px-2 py-1.5"><div className="text-[10.5px] uppercase tracking-wide text-muted">{l}</div><div className="h-tech num text-lg leading-tight">{v}</div></div>))}
        </div>
        <p className="text-[11px] text-muted mt-2">Ceq = Ccell / N. E = 0.5 × Ceq × (Vmax² − Vmin²), converted from joules to watt-hours. Currents and losses are approximate: constant power, no voltage sag during the boost.</p>
      </Card>

      <Card className="col-span-12 lg:col-span-4" title="Usable energy against bank voltage" right={<StatusBadge status="calc" />}>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={curve} margin={{ top: 20, right: 14, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="var(--line)" />
            <XAxis dataKey="v" type="number" domain={[eff.vMin, eff.vMax]} tick={{ fontSize: 11, fill: 'var(--muted)' }} label={{ value: 'Bank voltage, V', position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={44} label={{ value: 'Wh', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted)' }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)} Wh`, 'Usable energy']} labelFormatter={(v) => `${v} V`} />
            <ReferenceLine x={Number(eff.vNow.toFixed(2))} stroke="#E11B22" strokeDasharray="4 3" label={{ value: 'now', fontSize: 10, fill: '#E11B22', position: 'top' }} />
            <Line type="monotone" dataKey="wh" stroke={SIGNAL.uc} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted">Energy rises with the square of voltage, so the top quarter of the voltage range holds far more than the bottom quarter. A percentage gauge would hide that.</p>
      </Card>

      <Card className="col-span-12" title="8-cell against 10-cell bank" right={<><StatusBadge status="calc" /><StatusBadge status="sim" /></>} pad={false}>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-soft text-muted text-left border-b border-line"><th className="px-4 py-2 font-medium">Quantity</th><th className="px-3 py-2 font-medium text-right">10 cells</th><th className="px-3 py-2 font-medium text-right">8 cells</th><th className="px-4 py-2 font-medium">Basis</th></tr></thead>
          <tbody>
            {([['Total cell count', '10', '8', 'design'], ['Maximum voltage (2.5 V per cell)', `${ten.b.vMax} V`, `${eight.b.vMax} V`, 'calculated'],
              ['Equivalent capacitance', `${fmt(ten.o.ceq, 2)} F`, `${fmt(eight.o.ceq, 2)} F`, 'calculated'], ['Usable energy to 12.5 V', `${fmt(ten.o.eUsableWh, 2)} Wh`, `${fmt(eight.o.eUsableWh, 2)} Wh`, 'calculated'],
              ['Estimated cell cost (about ₹355 a cell)', '₹3,550', '₹2,840', 'retail estimate'], ['Estimated cell mass (78 g a cell)', '0.78 kg', '0.62 kg', 'datasheet estimate'],
              ['Boosts in full, warm WMTC, Eco', r10 ? `${r10.full}/${r10.requests}` : 'no data', r8 ? `${r8.full}/${r8.requests}` : 'no data', 'simulation output'],
              ['Bank voltage range on the cycle', r10 ? `${fmt(r10.ucVmin, 1)}–${fmt(r10.ucVmax, 1)} V` : 'no data', r8 ? `${fmt(r8.ucVmin, 1)}–${fmt(r8.ucVmax, 1)} V` : 'no data', 'simulation output'],
              ['End-of-life and hot coverage', 'simulated (aged/hot case)', 'not simulated', 'gap']] as [string, string, string, string][]).map(([q, a, b, basis]) => (
              <tr key={q} className="border-b border-line/60"><td className="px-4 py-1.5">{q}</td><td className="px-3 py-1.5 text-right num">{a}</td><td className="px-3 py-1.5 text-right num">{b}</td><td className="px-4 py-1.5 text-muted text-xs">{basis}</td></tr>))}
          </tbody>
        </table>
        <div className="p-3"><Notice tone="warn">Matching one drive-cycle result does not prove long-term durability or safe operation under every riding condition. The 8-cell bank has less margin at end of life and when hot, and that case has not been simulated.</Notice></div>
      </Card>
    </div>
  );
}
