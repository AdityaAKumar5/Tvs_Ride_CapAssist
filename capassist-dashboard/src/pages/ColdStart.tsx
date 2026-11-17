import { useEffect, useMemo, useState } from 'react';
import type { ActiveScenario, ColdScenario, DataBundle } from '../types';
import { useApp } from '../hooks/useApp';
import { useReplay, useReplayRange } from '../hooks/useReplay';
import { resolveScenario, parkLabel } from '../utils/scenario';
import { ReplayWorkbench } from '../components/ReplayWorkbench';
import { Readiness } from '../visualizations/Readiness';
import { KeyOnSequence } from '../visualizations/KeyOnSequence';
import { Card, Chip, InfoTip, Kpi, Notice, PageHead, Segmented, StatusBadge } from '../components/ui';
import { fmt } from '../utils/calc';
import { OUTCOME_COLOR, OUTCOME_LABEL, SIGNAL } from '../styles/theme';

type Pass = 'cold' | 'hot' | 'full';
const PARK = [12, 60, 168, 720];

export default function ColdStart() {
  const data = useApp((s) => s.data)!;
  const { condition, setCondition, coldKey, setColdKey } = useApp();
  const [pass, setPass] = useState<Pass>('full');
  // this page is about the cold package: leave the warm condition when it opens
  useEffect(() => { if (condition === 'warm') setCondition('cold'); }, [condition, setCondition]);

  const meta = data.cold.scenarios[coldKey];
  const full: ActiveScenario | null = useMemo(() => {
    const sc = resolveScenario(data, 'cold', coldKey);
    if (!sc) return null;
    // the continuous sequence: both passes, all events
    return { ...sc, range: [1, sc.series.n], events: data.cold.events[coldKey] ?? [] };
  }, [data, coldKey]);
  const n = full?.series.n ?? 1200; const half = n / 2;
  const range: [number, number] = pass === 'cold' ? [1, half] : pass === 'hot' ? [half + 1, n] : [1, n];
  useReplayRange(range[0], range[1]);
  if (!full || !meta) return null;

  const mode = meta.mode === 'Power' ? 'Power' : 'Eco';
  const pick = (m: string, h: number) => { const k = `${m === 'Power' ? 'DP' : 'D'}_park_${h}h`; if (data.cold.scenarios[k]) setColdKey(k); };
  const exists = (m: string, h: number) => Boolean(data.cold.scenarios[`${m === 'Power' ? 'DP' : 'D'}_park_${h}h`]);
  const isParking = meta.group === 'parking';
  const c = meta.cold;
  const stock = ['B1_stock', 'B2_stock', 'B3_stock'].map((k) => data.cold.scenarios[k]).filter(Boolean);
  const stockFull = stock.map((s) => s.cold.full);
  const warmTimes = data.cold.order.map((k) => data.cold.scenarios[k]).filter((s) => s.group !== 'sensitivity').map((s) => s.engine_warm_s).filter((x): x is number => x !== null);
  const firstReq = (data.cold.events[coldKey] ?? [])[0];

  return (
    <div className="space-y-4">
      <PageHead title="Cold Start & Parking" subtitle="Self-discharge while parked, key-on pre-charge, engine warm-up and the first 20 minutes of riding"
        right={<>
          <Segmented size="sm" value={mode} options={[{ value: 'Eco', label: 'Eco' }, { value: 'Power', label: 'Power' }]} onChange={(m) => pick(m, exists(m, meta.parked_hours) ? meta.parked_hours : 12)} />
          <div className="inline-flex rounded-lg border border-line bg-soft p-0.5">
            {PARK.map((h) => { const ok = exists(mode, h); const on = isParking && meta.parked_hours === h;
              return <button key={h} disabled={!ok} onClick={() => pick(mode, h)} title={ok ? `Parked ${parkLabel(h)}` : 'Not simulated for this mode: new simulation required'}
                className={`px-3 py-1 text-[13px] rounded-md font-medium ${on ? 'bg-navy dark:bg-electric text-white' : 'text-muted hover:text-ink'} disabled:opacity-35 disabled:cursor-not-allowed`}>{parkLabel(h)}</button>; })}
          </div>
        </>} />

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Scenario:</span><b className="text-head">{meta.case_label}</b>
        <Chip color={SIGNAL.cold}>Cold-start package · modelled, not measured</Chip>
        {!isParking && <Chip>{meta.group === 'baseline' ? 'Baseline system' : 'Sensitivity case'}</Chip>}
      </div>

      <Card title="Dual readiness: boost needs a warm engine and a charged bank" right={<StatusBadge status="sim" />}>
        <Readiness sc={full} />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Cold-pass boosts" value={c.requests ? `${c.full}/${c.requests}` : 'N/A'} accent={SIGNAL.full} sub="full / requested, first 600 s" />
        <Kpi label="Refused: engine cold" tip="gate" value={String(c.engineCold)} accent={SIGNAL.cold} sub="temperature gate, not the store" />
        <Kpi label="Denied or cut: energy" value={String(c.denied + c.cutShort)} accent={SIGNAL.denied} sub={`${c.denied} denied · ${c.cutShort} cut short`} />
        <Kpi label="Engine at gate" value={meta.engine_warm_s === null ? 'N/A' : String(meta.engine_warm_s)} unit="s" accent={SIGNAL.temp} status="assumed" sub={`base cases: ${Math.min(...warmTimes)}–${Math.max(...warmTimes)} s`} />
        <Kpi label="Bank at reserve" tip="reserve" value={meta.bank_at_reserve_s === null ? 'N/A' : String(meta.bank_at_reserve_s)} unit={meta.bank_at_reserve_s === null ? '' : 's'} accent={SIGNAL.uc}
          sub={meta.uc_voltage_at_key_on_v === null ? 'no bank fitted' : `from ${meta.uc_voltage_at_key_on_v.toFixed(1)} V at key-on`} />
        <Kpi label="Stock iGO, cold pass" value={stockFull.length ? `${Math.min(...stockFull)}–${Math.max(...stockFull)}` : 'N/A'} unit={`of ${stock[0]?.cold.requests ?? ''}`} accent={SIGNAL.lead} sub="depends on assumed battery acceptance" />
      </div>
      {firstReq && <Notice>First boost request at <b>{firstReq.t} s</b>: <b style={{ color: OUTCOME_COLOR[firstReq.outcome] }}>{OUTCOME_LABEL[firstReq.outcome]}</b>.
        {firstReq.outcome === 'engine_cold' && ' The same request is refused for stock iGO Assist: a cold-gated request is not a storage failure.'}</Notice>}

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title={<>Key-on pre-charge sequence <InfoTip term="precharge" /></>} right={<StatusBadge status="sim" />}><KeyOnSequence sc={full} /></Card>
        <Card className="col-span-12 xl:col-span-5" title="Parking duration: reference values" right={<StatusBadge status="sim" />} pad={false}><ParkTable data={data} current={coldKey} onPick={setColdKey} /></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h-tech text-xl">Cold and hot replay</h2>
        <Segmented value={pass} onChange={(p) => { useReplay.setState({ playing: false }); setPass(p); }}
          options={[{ value: 'cold', label: 'Cold pass only' }, { value: 'hot', label: 'Hot pass only' }, { value: 'full', label: 'Complete 20-minute sequence' }]} />
      </div>
      <ReplayWorkbench sc={full} range={range} divider={{ t: half + 0.5, label: 'COLD PASS ENDS | HOT PASS BEGINS' }} showTemp />

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-5" title="12 V battery energy during the cold pass" right={<StatusBadge status="sim" />}><BatteryBreakdown meta={meta} /></Card>
        <Card className="col-span-12 xl:col-span-7" title="Cold-start sensitivity lab" right={<StatusBadge status="sim" />}><SensitivityLab data={data} /></Card>
      </div>
    </div>
  );
}

function ParkTable({ data, current, onPick }: { data: DataBundle; current: string; onPick: (k: string) => void }) {
  const rows = data.cold.order.map((k) => data.cold.scenarios[k]).filter((s) => s.group === 'parking');
  return (
    <div>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-soft text-muted text-left border-b border-line">
          <th className="px-3 py-2 font-medium">Mode · parked</th><th className="px-2 py-2 font-medium text-right">V at key-on</th><th className="px-2 py-2 font-medium text-right">Connects</th>
          <th className="px-2 py-2 font-medium text-right">At reserve</th><th className="px-2 py-2 font-medium text-right">Engine warm</th><th className="px-3 py-2 font-medium text-right">Cold boosts</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.case_key} onClick={() => onPick(s.case_key)} className={`border-b border-line/60 cursor-pointer hover:bg-soft ${s.case_key === current ? 'bg-electric/10 font-semibold' : ''}`}>
              <td className="px-3 py-1.5">{s.mode} · {parkLabel(s.parked_hours)}</td>
              <td className="px-2 py-1.5 text-right num">{fmt(s.uc_voltage_at_key_on_v, 1)} V</td>
              <td className="px-2 py-1.5 text-right num">{s.bank_switch_closes_s === null ? 'at once' : `${s.bank_switch_closes_s} s`}</td>
              <td className="px-2 py-1.5 text-right num">{s.bank_at_reserve_s === null ? 'N/A' : `${s.bank_at_reserve_s} s`}</td>
              <td className="px-2 py-1.5 text-right num">{s.engine_warm_s === null ? 'N/A' : `${s.engine_warm_s} s`}</td>
              <td className="px-3 py-1.5 text-right num">{s.cold.full}/{s.cold.requests}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted">Modelled voltages with 1 mA leakage per cell (datasheet figure at rated voltage). These are not measured capacitor voltages. Lead-acid self-discharge while parked is not modelled, so the 12 V battery is assumed healthy after any park: that is an assumption, not a result.</p>
    </div>
  );
}

function BatteryBreakdown({ meta }: { meta: ColdScenario }) {
  const c = meta.cold;
  if (meta.family === 'conventional') return <p className="text-[13px] text-muted">The conventional case has no assist and no stop-start; its starter draw is not modelled.</p>;
  const total = c.batteryOutWh ?? 0;
  if (meta.family !== 'capassist') {
    return (<div className="text-[13px] space-y-2">
      <div className="flex items-baseline gap-2"><span className="h-tech num text-3xl">{fmt(total, 2)}</span><span className="text-muted">Wh from the 12 V battery in the cold pass, in {c.batteryPulses} pulses</span></div>
      <p className="text-muted">For the stock system the battery supplies every boost, every restart, the first start and the loads while the engine is off. The model output does not split this total by cause.</p>
    </div>);
  }
  const first = meta.first_start_pulse_wh; const pre = meta.precharge_from_battery_before_start_wh;
  const loads = Math.max(0, total - first - pre);
  const parts = [
    { label: '1 · First engine-start pulse', wh: first, color: SIGNAL.denied, note: 'one high-current pulse' },
    { label: '2 · Pre-charge before engine start', wh: pre, color: SIGNAL.uc, note: `${meta.key_on_to_engine_start_s} s at up to ${meta.precharge_current_a} A` },
    { label: '3 · Loads during engine-off stops', wh: loads, color: SIGNAL.lead, note: 'about 3 A, after the bank reaches its reserve' },
  ];
  const max = Math.max(0.01, ...parts.map((p) => p.wh));
  return (
    <div className="text-[13px]">
      <div className="space-y-2">
        {parts.map((p) => (<div key={p.label}>
          <div className="flex justify-between"><span>{p.label}</span><b className="num">{fmt(p.wh, 3)} Wh</b></div>
          <div className="h-2 rounded bg-soft"><div className="h-2 rounded" style={{ width: `${(p.wh / max) * 100}%`, background: p.color }} /></div>
          <div className="text-[11px] text-muted">{p.note}</div></div>))}
      </div>
      <div className="mt-3 flex justify-between border-t border-line pt-2"><span>Total in the cold pass</span><b className="num">{fmt(total, 2)} Wh · {c.batteryPulses} pulse{c.batteryPulses === 1 ? '' : 's'}</b></div>
      <div className="flex justify-between"><span>4 · Still owed to the battery at 600 s</span><b className="num">{fmt(c.batteryDeficitEndWh, 2)} Wh</b></div>
      <p className="text-[11px] text-muted mt-2">The cold start is not free of battery pulses: the first engine start is one. What CapAssist avoids in the model is the repeated assist and restart pulses while riding. The generator repays the battery after each stop.</p>
    </div>
  );
}

const LAB: { key: string; label: string }[] = [
  { key: 'D_park_720h', label: 'Base: pre-charge at 5 A' },
  { key: 'D_720h_warm_fast', label: 'Engine warms twice as fast' },
  { key: 'D_720h_warm_slow', label: 'Engine warms half as fast' },
  { key: 'D_720h_ambient_15c', label: 'Ambient 15 °C' },
  { key: 'D_720h_precharge_2p5a', label: 'Pre-charge 2.5 A' },
  { key: 'D_720h_precharge_10a', label: 'Pre-charge 10 A' },
  { key: 'D_720h_payback_34w', label: 'Battery pay-back 34 W' },
  { key: 'D_park_12h_balancing_on', label: 'Balancing left connected (12 h)' },
];

function SensitivityLab({ data }: { data: DataBundle }) {
  const [sel, setSel] = useState('D_720h_precharge_10a');
  const [amps, setAmps] = useState('5'); const [amb, setAmb] = useState('30');
  const base = data.cold.scenarios['D_park_720h']; const s = data.cold.scenarios[sel];
  const setColdKey = useApp((st) => st.setColdKey);
  if (!base || !s) return <p className="text-[13px] text-muted">Sensitivity scenarios are not in the loaded data.</p>;
  const custom = data.cold.order.map((k) => data.cold.scenarios[k]).find((x) => x.parked_hours === 720 && x.case_id === 'D'
    && Math.abs(x.precharge_current_a - Number(amps)) < 1e-6 && Math.abs(x.ambient_c - Number(amb)) < 1e-6
    && Object.keys(x.parameter_overrides).every((p) => p === 'pre_a' || p === 't_amb'));
  const tMax = 260;
  const bar = (label: string, t: number | null, color: string) => (
    <div className="flex items-center gap-2 text-xs"><span className="w-36 text-muted">{label}</span>
      <div className="flex-1 h-3 bg-soft rounded relative border border-line"><div className="h-full rounded" style={{ width: `${Math.min(100, ((t ?? 0) / tMax) * 100)}%`, background: color }} /></div>
      <b className="num w-12 text-right">{t === null ? 'N/A' : `${t} s`}</b></div>);
  const eligibleAt = (x: ColdScenario) => (x.bank_at_reserve_s === null || x.engine_warm_s === null ? null : Math.max(x.bank_at_reserve_s, x.engine_warm_s));
  const row = (label: string, f: (x: ColdScenario) => string) => (<tr key={label} className="border-b border-line/60"><td className="py-1 pr-2">{label}</td><td className="py-1 text-right num text-muted">{f(base)}</td><td className="py-1 text-right num font-semibold">{f(s)}</td></tr>);
  const limiting = (x: ColdScenario) => ((x.bank_at_reserve_s ?? 0) > (x.engine_warm_s ?? 0) ? 'the bank' : 'the engine temperature');
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {LAB.filter((l) => data.cold.scenarios[l.key]).map((l) => (
            <button key={l.key} onClick={() => setSel(l.key)} className={`rounded-full border px-2.5 py-0.5 text-xs ${sel === l.key ? 'bg-navy dark:bg-electric text-white border-navy' : 'border-line bg-soft hover:border-electric'}`}>{l.label}</button>))}
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted uppercase tracking-wide">Base (one month parked, 5 A)</div>
          {bar('Bank at reserve', base.bank_at_reserve_s, SIGNAL.uc)}{bar('Engine at 55 °C', base.engine_warm_s, SIGNAL.temp)}{bar('Boost eligible', eligibleAt(base), SIGNAL.full)}
          <div className="text-[11px] text-muted uppercase tracking-wide pt-2">{s.case_label}</div>
          {bar('Bank at reserve', s.bank_at_reserve_s, SIGNAL.uc)}{bar('Engine at 55 °C', s.engine_warm_s, SIGNAL.temp)}{bar('Boost eligible', eligibleAt(s), SIGNAL.full)}
        </div>
        <div className="mt-3"><Notice>In this case boost eligibility is set by <b>{limiting(s)}</b>. A faster pre-charge does not help while the engine is still cold, and a faster warm-up does not help while the bank is not ready.</Notice></div>
        <button onClick={() => setColdKey(sel)} className="mt-2 text-xs text-electric underline">Replay this case above</button>
      </div>
      <div>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-left text-muted border-b border-line"><th className="py-1 font-medium">Output</th><th className="py-1 font-medium text-right">Base</th><th className="py-1 font-medium text-right">Selected</th></tr></thead>
          <tbody>
            {row('Voltage at key-on', (x) => `${fmt(x.uc_voltage_at_key_on_v, 1)} V`)}
            {row('Bank connection time', (x) => (x.bank_switch_closes_s === null ? 'at once' : `${x.bank_switch_closes_s} s`))}
            {row('Time to reserve', (x) => (x.bank_at_reserve_s === null ? 'N/A' : `${x.bank_at_reserve_s} s`))}
            {row('Engine warm-up time', (x) => (x.engine_warm_s === null ? 'N/A' : `${x.engine_warm_s} s`))}
            {row('Cold boost requests', (x) => String(x.cold.requests))}
            {row('Full boosts', (x) => String(x.cold.full))}
            {row('Cold-gated requests', (x) => String(x.cold.engineCold))}
            {row('Energy-related denials', (x) => String(x.cold.denied + x.cold.cutShort))}
            {row('Battery output energy', (x) => `${fmt(x.cold.batteryOutWh, 2)} Wh`)}
            {row('Pre-charge from battery', (x) => `${fmt(x.precharge_from_battery_before_start_wh, 3)} Wh`)}
            {row('Cold fuel consumption', (x) => `${fmt(x.cold.fuelMl, 1)} mL`)}
            {row('Weighted fuel economy', (x) => `${fmt(x.weighted_km_per_l, 2)} km/L`)}
          </tbody>
        </table>
        <div className="mt-3 rounded-lg border border-line p-2.5 bg-soft">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Try other parameters</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">Pre-charge <input value={amps} onChange={(e) => setAmps(e.target.value)} className="w-14 border border-line rounded px-1 py-0.5 bg-panel num" /> A</label>
            <label className="flex items-center gap-1">Ambient <input value={amb} onChange={(e) => setAmb(e.target.value)} className="w-14 border border-line rounded px-1 py-0.5 bg-panel num" /> °C</label>
          </div>
          {custom ? <p className="text-xs mt-1.5">Simulated: <button className="text-electric underline" onClick={() => setSel(custom.case_key)}>{custom.case_label}</button></p>
            : <p className="text-xs mt-1.5 font-semibold text-racing">New simulation required to evaluate modified parameters.</p>}
          <p className="text-[11px] text-muted mt-1">The dashboard does not estimate results it has no simulation for. Run <code>sim.py</code> with the new values and import the output.</p>
        </div>
      </div>
    </div>
  );
}
