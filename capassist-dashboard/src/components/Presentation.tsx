import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DataBundle } from '../types';
import { useApp } from '../hooks/useApp';
import { useReplay, useReplayRange } from '../hooks/useReplay';
import { localise, parkLabel, resolveScenario } from '../utils/scenario';
import { availRows } from '../utils/rows';
import { AvailabilityChart, AvailabilityLegend } from '../charts/AvailabilityChart';
import { TimeStrip } from '../charts/TimeStrip';
import { Architecture, STATES } from '../visualizations/Architecture';
import { Readiness } from '../visualizations/Readiness';
import { KeyOnSequence } from '../visualizations/KeyOnSequence';
import { DualView } from './DualView';
import { ReplayControls } from './ReplayControls';
import { Notice } from './ui';
import { SIGNAL } from '../styles/theme';
import { fmt } from '../utils/calc';

const STEPS = ['The real-world problem', 'Existing TVS iGO Assist', 'CapAssist architecture', 'Warm WMTC replay', 'Cold morning start', 'Long parking', 'Results comparison', 'Conclusions'];

/** Full-screen guided demonstration. Right and left arrows change step; Esc leaves. */
export function Presentation() {
  const data = useApp((s) => s.data)!;
  const setPresenting = useApp((s) => s.setPresenting);
  const [step, setStep] = useState(0);
  const close = () => { useReplay.setState({ playing: false }); if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined); setPresenting(false); };
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setStep((s) => Math.max(0, s - 1)); }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { useReplay.setState({ playing: false }); }, [step]);
  return (
    <div className="fixed inset-0 z-[70] bg-bg overflow-auto flex flex-col">
      <header className="bg-navy text-white px-6 h-14 flex items-center gap-4 shrink-0">
        <span className="font-tech font-bold text-xl tracking-[0.14em]">CAP<span className="text-racing">ASSIST</span></span>
        <span className="font-tech text-lg text-white/90">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {STEPS.map((s, k) => <button key={s} onClick={() => setStep(k)} title={s} aria-label={`Step ${k + 1}: ${s}`}
            className={`h-2 rounded-full transition-all ${k === step ? 'w-10 bg-racing' : k < step ? 'w-5 bg-white/70' : 'w-5 bg-white/25'}`} />)}
        </div>
        <span className="text-xs text-white/60 hidden md:inline">Engineering Concept Demonstrator — Not Production Validated</span>
        <button onClick={close} className="p-1.5 rounded hover:bg-white/10" aria-label="Leave presentation mode"><X size={18} /></button>
      </header>
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-8 py-5">
        {step === 0 && <Problem data={data} />}
        {step === 1 && <Stock data={data} />}
        {step === 2 && <Arch />}
        {step === 3 && <WarmReplay data={data} />}
        {step === 4 && <ColdMorning data={data} keys={['D_park_12h']} title="An overnight-parked motorcycle: two readiness conditions" />}
        {step === 5 && <ColdMorning data={data} keys={['D_park_168h', 'D_park_720h']} title="Long parking: pre-charge, then generator replenishment" sequence />}
        {step === 6 && <Results data={data} />}
        {step === 7 && <Conclusions />}
      </main>
      <footer className="shrink-0 border-t border-line bg-panel px-6 h-14 flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 border border-line rounded-md px-3 py-1.5 disabled:opacity-40"><ChevronLeft size={16} />Back</button>
        <span className="text-xs text-muted">All results are simulation outputs on WMTC Part 1 (reduced speed). No physical measurements are shown.</span>
        <button onClick={() => (step === STEPS.length - 1 ? close() : setStep((s) => s + 1))} className="flex items-center gap-1 bg-racing text-white rounded-md px-4 py-1.5 font-medium">
          {step === STEPS.length - 1 ? 'Finish' : 'Next step'}<ChevronRight size={16} /></button>
      </footer>
    </div>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return <div className="mb-4"><h1 className="h-tech text-[34px] leading-tight">{children}</h1>{sub && <p className="text-muted text-base">{sub}</p>}</div>;
}
function Points({ items }: { items: string[] }) {
  return <ul className="space-y-2 text-[17px] leading-snug">{items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 w-2 h-2 rounded-full bg-racing shrink-0" />{i}</li>)}</ul>;
}

function Problem({ data }: { data: DataBundle }) {
  const sc = useMemo(() => resolveScenario(data, 'warm', 'B2'), [data]);
  useReplayRange(1, 600);
  if (!sc) return null;
  const s = sc.series; let stops = 0; let idle = 0;
  for (let i = 0; i < s.n; i++) { if (s.speed[i] < 0.5) idle++; if (i > 0 && s.speed[i] < 0.5 && s.speed[i - 1] >= 0.5) stops++; }
  return (
    <div>
      <Title sub="WMTC Part 1, reduced speed: the urban cycle used for a Class 1 motorcycle">Stop-and-go traffic asks for many short bursts of assist</Title>
      <div className="bg-panel border border-line rounded-xl p-3 mb-4"><TimeStrip t={s.t} values={s.speed} range={[1, 600]} label="Speed" unit="km/h" color={SIGNAL.speed} height={260} fill yMin={0} yMax={60} events={sc.events} /></div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {([[`${(data.warm.info.distanceM / 1000).toFixed(2)} km`, 'in 600 s'], [String(stops), 'stops'], [`${idle} s`, 'standing still'], [String(sc.summary.requests), 'boost requests (triangles)']] as [string, string][]).map(([v, l]) => (
          <div key={l} className="bg-panel border border-line rounded-xl p-3 text-center"><div className="h-tech num text-4xl">{v}</div><div className="text-muted">{l}</div></div>))}
      </div>
      <Points items={['Each launch asks the electrical system for a burst of about 35 A, then asks again seconds later.',
        'A small lead-acid battery can give the burst, but needs time to take the energy back before the next one.',
        'The energy in each burst is small (under 1 Wh). The difficulty is how often and how fast, not how much.']} />
    </div>
  );
}

function Stock({ data }: { data: DataBundle }) {
  return (
    <div>
      <Title sub="Warm steady state. Three battery charge-acceptance values, because the real one is not known">The stock system refuses some repeat boosts in the simulation</Title>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 bg-panel border border-line rounded-xl p-4"><AvailabilityChart rows={availRows(data, 'warm', undefined, ['B1', 'B2', 'B3'])} height={300} /><AvailabilityLegend /></div>
        <div className="col-span-5"><Points items={['The owner\'s manual describes a charging period after each boost.',
          'In the model, the next boost is refused until the last one\'s energy is back in the battery.',
          'Depending on how fast the battery recharges, four to seven of nine requests are delivered in full.',
          'That lock-out rule and the acceptance values are assumptions. A stopwatch test on a real Raider would replace them.']} /></div>
      </div>
    </div>
  );
}

const TOUR = ['replenish', 'eco_boost', 'regen', 'engine_stop', 'handover', 'restart'];
function Arch() {
  const [id, setId] = useState('eco_boost');
  const st = STATES.find((s) => s.id === id)!;
  return (
    <div>
      <Title sub="Option Y: the starter generator, engine and 12 V system are the stock parts">An ultracapacitor bank takes the bursts; the 12 V battery keeps its ordinary jobs</Title>
      <div className="flex flex-wrap gap-2 mb-3">{TOUR.map((t) => { const s = STATES.find((x) => x.id === t)!;
        return <button key={t} onClick={() => setId(t)} className={`rounded-full px-3 py-1 text-sm border ${id === t ? 'text-white border-transparent' : 'border-line bg-panel'}`} style={id === t ? { background: s.color } : undefined}>{s.label}</button>; })}</div>
      <div className="bg-panel border border-line rounded-xl p-4"><Architecture option="Y" stateId={id} /></div>
      <div className="grid grid-cols-2 gap-4 mt-3 text-base"><p><b className="text-head">What happens. </b>{st.what}</p><p><b className="text-head">Why. </b>{st.why}</p></div>
    </div>
  );
}

function WarmReplay({ data }: { data: DataBundle }) {
  const a = useMemo(() => resolveScenario(data, 'warm', 'D'), [data]);
  const b = useMemo(() => resolveScenario(data, 'warm', 'DP'), [data]);
  if (!a || !b) return null;
  return (
    <div>
      <Title sub="Logged model output for both modes, on one shared time cursor. Press Play.">Eco and Power through a continuous urban cycle</Title>
      <DualView a={a} b={b} compact />
    </div>
  );
}

function ColdMorning({ data, keys, title, sequence }: { data: DataBundle; keys: string[]; title: string; sequence?: boolean }) {
  const [key, setKey] = useState(keys[0]);
  useEffect(() => setKey(keys[0]), [keys]);
  const sc = useMemo(() => { const r = resolveScenario(data, 'cold', key); return r ? localise(r) : null; }, [data, key]);
  useReplayRange(1, 600);
  if (!sc || !sc.cold) return null;
  return (
    <div>
      <Title sub={`${sc.cold.case_label}. Cold pass, first 600 s after engine start. Press Play.`}>{title}</Title>
      {keys.length > 1 && <div className="flex gap-2 mb-3">{keys.map((k) => <button key={k} onClick={() => { useReplay.setState({ playing: false, t: 1 }); setKey(k); }}
        className={`rounded-full px-3 py-1 text-sm border ${key === k ? 'bg-navy dark:bg-electric text-white border-navy' : 'border-line bg-panel'}`}>Parked {parkLabel(data.cold.scenarios[k].parked_hours)}</button>)}</div>}
      <div className="bg-panel border border-line rounded-xl p-3 mb-3"><ReplayControls scenario={sc} compact /></div>
      <Readiness sc={sc} />
      {sequence && <div className="bg-panel border border-line rounded-xl p-3 mt-3"><KeyOnSequence sc={sc} wide /></div>}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-panel border border-line rounded-xl p-2"><TimeStrip t={sc.series.t} values={sc.series.temp} range={[1, 600]} label="Engine temperature (modelled)" unit="°C" color={SIGNAL.temp} height={120}
          refLines={[{ y: 55, label: 'boost gate 55 °C', color: SIGNAL.cold }]} events={sc.events} /></div>
        <div className="bg-panel border border-line rounded-xl p-2"><TimeStrip t={sc.series.t} values={sc.series.ucV} range={[1, 600]} label="Bank voltage (modelled)" unit="V" color={SIGNAL.uc} digits={1} height={120}
          refLines={[{ y: sc.meta.reserve_v ?? 19.3, label: 'reserve', color: SIGNAL.uc }, { y: 12.5, label: 'connect 12.5 V', color: SIGNAL.denied }]} /></div>
      </div>
      <p className="text-sm text-muted mt-2">Cold pass: {sc.cold.cold.full} of {sc.cold.cold.requests} boosts in full; {sc.cold.cold.engineCold} refused because the engine was cold. Bank at reserve at {sc.cold.bank_at_reserve_s} s, engine at the gate at {sc.cold.engine_warm_s} s. The warm-up rate is an assumption.</p>
    </div>
  );
}

function Results({ data }: { data: DataBundle }) {
  const f = (id: string) => fmt(data.warm.scenarios[id]?.summary.kmPerL ?? null, 1);
  return (
    <div>
      <Title sub="Warm steady state, WMTC Part 1">Stock, CapAssist Eco, CapAssist Power and high-power lithium</Title>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 bg-panel border border-line rounded-xl p-4"><AvailabilityChart rows={availRows(data, 'warm', undefined, ['B2', 'D', 'DP', 'F'])} height={330} /><AvailabilityLegend /></div>
        <div className="col-span-5 space-y-3">
          <Points items={['CapAssist delivers every boost in both modes; the stock case shown delivers six of nine.',
            'A high-power lithium 12 V battery does just as well in this model. We do not claim it is inferior.',
            `Fuel economy is nearly the same for all four: ${f('B2')}, ${f('D')}, ${f('DP')} and ${f('F')} km/L.`]} />
          <Notice tone="warn">Eco uses a shorter boost than stock and Power, so these bars are not a hardware-only comparison.</Notice>
        </div>
      </div>
    </div>
  );
}

function Conclusions() {
  return (
    <div>
      <Title sub="What the simulation supports, and what it does not yet">Conclusions</Title>
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-panel border border-line rounded-xl p-5"><h3 className="h-tech text-xl mb-2 text-ok">Modelled results</h3>
          <Points items={['Main benefit: boost availability. Every Eco boost delivered, where stock delivers four to seven of nine.',
            'Secondary benefit: no repeated high-current pulses on the 12 V battery while riding.',
            'Small fuel benefit: well under 1% over stock iGO Assist.']} /></div>
        <div className="bg-panel border border-line rounded-xl p-5"><h3 className="h-tech text-xl mb-2 text-racing">Still to prove</h3>
          <Points items={['Generator power in short bursts, and controller and motor temperature.', 'Battery-life benefit, and a fair comparison with a lithium 12 V battery.',
            'Production feasibility: cost of the controller change, converter and protection.', 'A bench prototype and a matched-request comparison come next.']} /></div>
      </div>
    </div>
  );
}
