import { Download } from 'lucide-react';
import type { ActiveScenario, DataBundle } from '../types';
import { useApp } from '../hooks/useApp';
import { useSelScenario } from '../hooks/useScenario';
import { SelSelect } from '../components/ScenarioSelect';
import { DualView } from '../components/DualView';
import { BoostProfile } from '../visualizations/BoostProfile';
import { Btn, Card, InfoTip, Notice, PageHead, StatusBadge } from '../components/ui';
import { availability, fmt } from '../utils/calc';
import { downloadCsv } from '../utils/export';
import { SIGNAL } from '../styles/theme';

interface MetricRow { label: string; a: number | null; b: number | null; digits: number; unit: string; better: 'high' | 'low' | null; boost?: boolean; tip?: string; }

function metrics(a: ActiveScenario, b: ActiveScenario): MetricRow[] {
  const A = a.summary; const B = b.summary;
  const li = (sc: ActiveScenario, v: number | null) => (sc.meta.family === 'lithium' ? null : v);
  return [
    { label: 'Boost requests', a: A.requests, b: B.requests, digits: 0, unit: '', better: null, boost: true },
    { label: 'Boosts fully delivered', a: A.full, b: B.full, digits: 0, unit: '', better: 'high', boost: true },
    { label: 'Partial (cut short)', a: A.cutShort, b: B.cutShort, digits: 0, unit: '', better: 'low', boost: true },
    { label: 'Denied by the energy store', a: A.denied, b: B.denied, digits: 0, unit: '', better: 'low', boost: true },
    { label: 'Refused: engine cold', a: A.engineCold, b: B.engineCold, digits: 0, unit: '', better: null, boost: true },
    { label: 'Boost availability', a: availability(A.full, A.requests), b: availability(B.full, B.requests), digits: 0, unit: '%', better: 'high', boost: true, tip: 'availability' },
    { label: 'Total electric-assist energy', a: A.boostWh, b: B.boostWh, digits: 2, unit: 'Wh', better: null, boost: true },
    { label: 'Regenerative energy', a: A.regenWh, b: B.regenWh, digits: 2, unit: 'Wh', better: 'high', tip: 'regen' },
    { label: '12 V battery output energy', a: li(a, A.batteryOutWh), b: li(b, B.batteryOutWh), digits: 2, unit: 'Wh', better: 'low' },
    { label: 'Battery pulse count', a: li(a, A.batteryPulses), b: li(b, B.batteryPulses), digits: 0, unit: '', better: 'low', tip: 'pulse' },
    { label: 'Engine-off time', a: A.engineOffS, b: B.engineOffS, digits: 0, unit: 's', better: null },
    { label: 'Fuel consumed', a: A.fuelMl, b: B.fuelMl, digits: 1, unit: 'mL', better: 'low' },
    { label: 'Fuel economy', a: A.kmPerL, b: B.kmPerL, digits: 1, unit: 'km/L', better: 'high' },
    { label: 'Bank voltage, lowest', a: A.ucVmin, b: B.ucVmin, digits: 1, unit: 'V', better: null },
    { label: 'Bank voltage, highest', a: A.ucVmax, b: B.ucVmax, digits: 1, unit: 'V', better: null },
  ];
}

export default function Compare() {
  const data = useApp((s) => s.data)!;
  const { compareA, compareB, setCompare } = useApp();
  const a = useSelScenario(compareA); const b = useSelScenario(compareB);
  if (!a || !b) return null;
  const sameProfile = a.meta.boost_profile === b.meta.boost_profile;
  const sameCondition = a.condition === b.condition;
  const rows = metrics(a, b);
  const exportCsv = () => downloadCsv('capassist_comparison.csv', [['metric', 'unit', `A: ${a.label} (${a.condition})`, `B: ${b.label} (${b.condition})`],
    ...rows.map((r) => [r.label, r.unit, r.a === null ? null : Number(r.a.toFixed(r.digits)), r.b === null ? null : Number(r.b.toFixed(r.digits))])]);

  return (
    <div className="space-y-4">
      <PageHead title="Mode Comparison" subtitle="Side-by-side comparison of any two simulated systems, with the limits of each comparison stated"
        right={<><SelSelect label="Scenario A" value={compareA} onChange={(v) => setCompare('A', v)} /><SelSelect label="Scenario B" value={compareB} onChange={(v) => setCompare('B', v)} />
          <Btn onClick={exportCsv} title="Export this comparison"><Download size={14} />CSV</Btn></>} />

      {(!sameProfile || !sameCondition) && (
        <Notice tone="warn"><b>Boost requests and delivered energy are not equivalent across all modes.</b> A matched torque-demand and request-schedule comparison is required to isolate storage-hardware benefits.
          {!sameCondition && ' These two scenarios also start from different operating conditions.'} Boost rows below are shown without a "better" mark.</Notice>
      )}

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title="Main comparison metrics" right={<StatusBadge status="sim" />} pad={false}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-muted border-b border-line bg-soft">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium text-right w-[30%]"><span className="bg-navy text-white rounded px-1.5 text-xs mr-1">A</span>{a.shortLabel}</th>
              <th className="px-3 py-2 font-medium text-right w-[30%]"><span className="bg-navy text-white rounded px-1.5 text-xs mr-1">B</span>{b.shortLabel}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const judge = r.better && r.a !== null && r.b !== null && r.a !== r.b && (!r.boost || (sameProfile && sameCondition));
                const aWins = judge && (r.better === 'high' ? r.a! > r.b! : r.a! < r.b!);
                const bWins = judge && !aWins;
                const cell = (v: number | null, win: boolean | null | '') => (
                  <td className={`px-3 py-1.5 text-right num ${win ? 'font-semibold text-ok' : ''}`}>{v === null ? <span className="text-muted">N/A</span> : `${v.toFixed(r.digits)}${r.unit ? ' ' + r.unit : ''}`}{win ? ' ●' : ''}</td>);
                return (<tr key={r.label} className="border-b border-line/60">
                  <td className="px-4 py-1.5">{r.label} {r.tip && <InfoTip term={r.tip} />}</td>{cell(r.a, aWins)}{cell(r.b, bWins)}</tr>);
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted">● marks the better figure only where the two are directly comparable. Absolute fuel economy is not calibrated; read differences only.</p>
        </Card>

        <Card className="col-span-12 xl:col-span-5" title="High-power lithium 12 V: the alternative" right={<StatusBadge status="sim" />}>
          <LithiumPanel data={data} />
        </Card>
      </div>

      <Card title="Eco versus Power" right={<StatusBadge status="spec" />}>
        <div className="grid md:grid-cols-2 gap-5">
          <ModeCard title="Eco mode" color={SIGNAL.uc} mode="eco" result={data.warm.scenarios.D?.summary} items={[
            'Three seconds of full electric assist', 'One-second fade', 'Maximum modelled energy about 0.42 Wh', 'Two-boost reserve policy (about 19.3 V)',
            'Stop-start enabled', 'Intended for urban stop-and-go traffic']} />
          <ModeCard title="Power mode" color={SIGNAL.fallback} mode="power" result={data.warm.scenarios.DP?.summary} items={[
            'Up to eight seconds of sustained electric assistance', 'Maximum modelled energy about 0.96 Wh', 'One-boost reserve policy (about 20.0 V)',
            'Stop-start disabled in the design specification', 'Intended for more sustained acceleration']} />
        </div>
        <div className="mt-3"><Notice tone="warn"><b>Model and specification disagree on one point.</b> The specification turns stop-start off in Power mode. The current simulation case for Power still has it on
          ({fmt(data.warm.scenarios.DP?.summary.engineOffS ?? null, 0)} s engine-off), so its fuel and engine-off figures are optimistic. Boost counts are not affected by this.</Notice></div>
        <p className="text-xs text-muted mt-2">Profiles are nominal maximums from the design specification at 6,000 rpm (432 W electrical). They are not measured waveforms; in the simulation the power falls with engine speed.</p>
      </Card>

      <Card title="Stress cases (precomputed)" right={<StatusBadge status="sim" />} pad={false}><StressTable data={data} /></Card>

      <div>
        <h2 className="h-tech text-xl mb-2">Dual-simulation view</h2>
        <p className="text-xs text-muted mb-2">Scenarios A and B replayed against one shared time cursor. Each strip is the logged model output for that system.</p>
        <DualView a={a} b={b} />
      </div>
    </div>
  );
}

function ModeCard({ title, color, mode, items, result }: { title: string; color: string; mode: 'eco' | 'power'; items: string[]; result?: { full: number; requests: number } }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between"><h4 className="h-tech text-lg" style={{ color }}>{title}</h4>
        {result && <span className="h-tech num text-2xl">{result.full}/{result.requests} <span className="text-xs text-muted font-sans font-normal">full boosts, warm base case</span></span>}</div>
      <div className="grid grid-cols-2 gap-3 items-center">
        <ul className="text-[13px] list-disc pl-4 space-y-0.5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        <BoostProfile mode={mode} color={color} />
      </div>
    </div>
  );
}

function StressTable({ data }: { data: DataBundle }) {
  const cases = ['B2', 'D', 'DP', 'DA', 'F'].filter((c) => data.warm.scenarios[c]);
  const vars = [...new Map(data.sensitivity.map((r) => [r.variation_key, r.variation_label])).entries()];
  if (!vars.length) return <p className="p-4 text-[13px] text-muted">No precomputed stress cases in the loaded data (warm_sensitivity.csv).</p>;
  const cell = (vk: string, cid: string) => {
    const r = data.sensitivity.find((x) => x.variation_key === vk && x.case_id === cid);
    if (!r) return <td key={cid} className="px-3 py-1.5 text-center text-muted">no data</td>;
    const all = r.boosts_full === r.boost_requests;
    return <td key={cid} className="px-3 py-1.5 text-center num"><span className={`inline-block rounded px-2 py-0.5 ${all ? 'bg-ok/10 text-ok' : 'bg-regen/10 text-ink'}`}>{r.boosts_full}/{r.boost_requests}</span>
      <span className="text-muted text-xs ml-2">{fmt(r.km_per_l, 1)} km/L</span></td>;
  };
  return (
    <div>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-soft text-muted text-left border-b border-line"><th className="px-4 py-2 font-medium">Changed assumption</th>
          {cases.map((c) => <th key={c} className="px-3 py-2 font-medium text-center">{data.warm.scenarios[c].short_name}</th>)}</tr></thead>
        <tbody>{vars.map(([vk, vl]) => <tr key={vk} className="border-b border-line/60"><td className="px-4 py-1.5">{vl}</td>{cases.map((c) => cell(vk, c))}</tr>)}</tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted">Full boosts / requests, warm steady state. "CapAssist aged/hot" is the hot and aged capacitor case: capacitance −20%, resistance ×2, 23 V limit (assumed, not measured on cells). Only outcomes the simulation actually produced are shown.</p>
    </div>
  );
}

function LithiumPanel({ data }: { data: DataBundle }) {
  const li = data.warm.scenarios.F?.summary; const d = data.warm.scenarios.D?.summary;
  const open = ['Total installed cost', 'Cycle life under repeated high-current duty', 'Thermal performance', 'Degradation', 'Warranty economics', 'Weight', 'Packaging', 'Maintenance'];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-line p-3"><div className="text-xs text-muted">High-power lithium, Eco profile</div>
          <div className="h-tech num text-3xl" style={{ color: SIGNAL.lithium }}>{li ? `${li.full}/${li.requests}` : 'N/A'}</div><div className="text-xs text-muted num">{fmt(li?.kmPerL ?? null, 1)} km/L</div></div>
        <div className="rounded-lg border border-line p-3"><div className="text-xs text-muted">CapAssist Y Eco</div>
          <div className="h-tech num text-3xl" style={{ color: SIGNAL.uc }}>{d ? `${d.full}/${d.requests}` : 'N/A'}</div><div className="text-xs text-muted num">{fmt(d?.kmPerL ?? null, 1)} km/L</div></div>
      </div>
      <Notice><b>The lithium battery matches CapAssist Eco on modelled boost availability.</b> This model cannot separate the two. It does not show that lithium is inferior.</Notice>
      <h4 className="h-tech uppercase text-sm mt-3 mb-1">Unresolved comparison factors</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        {open.map((o) => <div key={o} className="flex items-center justify-between border-b border-line/60 py-0.5"><span>{o}</span><span className="text-[11px] rounded bg-soft border border-line px-1.5 text-muted">Not tested</span></div>)}
      </div>
    </div>
  );
}
