import { useMemo } from 'react';
import type { ActiveScenario } from '../types';
import { TimeStrip, type RefLine } from '../charts/TimeStrip';
import { Gauge } from '../charts/Gauge';
import { useReplay, useReplaySecond } from '../hooks/useReplay';
import { indexAt, inferState } from '../utils/stateInfer';
import { OUTCOME_COLOR, OUTCOME_LABEL, SIGNAL } from '../styles/theme';
import { Card, InfoTip, StatusBadge } from './ui';
import { ReplayControls } from './ReplayControls';

interface Props { sc: ActiveScenario; range: [number, number]; divider?: { t: number; label: string }; showTemp?: boolean; }

/** The synchronized replay: main speed chart, live instruments, inferred state, event list and signal strips. */
export function ReplayWorkbench({ sc, range, divider, showTemp }: Props) {
  const s = sc.series;
  const refs: RefLine[] = useMemo(() => {
    const r: RefLine[] = [];
    if (sc.meta.reserve_v) r.push({ y: sc.meta.reserve_v, label: `reserve ${sc.meta.reserve_v.toFixed(1)} V`, color: SIGNAL.uc });
    if (sc.meta.bank) r.push({ y: sc.meta.bank.v_min, label: `lower limit ${sc.meta.bank.v_min} V`, color: SIGNAL.denied });
    return r;
  }, [sc]);
  const engineOff = useMemo(() => s.engineOn.map((e) => (e === 0 ? 1 : 0)), [s]);
  const engineOnVals = s.engineOn as (number | null)[];
  return (
    <div className="space-y-3">
      <Card pad={false}><div className="px-4 py-2.5"><ReplayControls scenario={sc} /></div></Card>
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title="Vehicle speed against time"
          right={<><Legend /><StatusBadge status="sim" /></>}>
          <TimeStrip t={s.t} values={s.speed} range={range} label="Speed" unit="km/h" color={SIGNAL.speed} height={400} fill yMin={0} yMax={60}
            events={sc.events} shade={engineOff} divider={divider} />
          <p className="text-xs text-muted mt-1">Triangles are boost requests. A triangle takes its colour when the replay reaches the end of that boost, because the outcome is not known earlier. Grey bands: engine off. Drag on any chart to scrub.</p>
        </Card>
        <Card className="col-span-12 md:col-span-7 xl:col-span-3" title="Instruments" right={<StatusBadge status="sim" />}><Instruments sc={sc} showTemp={showTemp} /></Card>
        <div className="col-span-12 md:col-span-5 xl:col-span-2 space-y-3"><StatePanel sc={sc} /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.speed} range={range} label="1 · Speed" unit="km/h" color={SIGNAL.speed} yMin={0} yMax={60} divider={divider} /></Card>
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.ucV} range={range} label="2 · Ultracapacitor voltage" unit="V" color={SIGNAL.uc} digits={1}
          yMin={sc.hasBank ? undefined : 0} refLines={refs} divider={divider} naText="N/A: this system has no ultracapacitor bank" /></Card>
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.assistW} range={range} label="3 · ISG assist electrical power" unit="W" color={SIGNAL.assist} yMin={0} fill divider={divider} /></Card>
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.genW} range={range} label="4 · Total generator electrical output" unit="W" color={SIGNAL.generator} yMin={0} divider={divider} /></Card>
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={engineOnVals} range={range} label="5 · Engine on (1) / off (0)" unit="" color={SIGNAL.lead} yMin={0} yMax={1.2} stepped fill divider={divider} /></Card>
        <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.fuel} range={range} label="6 · Fuel consumption rate" unit="mL/s" color={SIGNAL.fuel} yMin={0} digits={3} divider={divider} /></Card>
        {showTemp && <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.temp} range={range} label="7 · Engine temperature (modelled)" unit="°C" color={SIGNAL.temp} digits={0}
          refLines={[{ y: 55, label: 'boost gate 55 °C', color: SIGNAL.cold }]} divider={divider} /></Card>}
        {showTemp && <Card pad={false} className="px-2 py-1"><TimeStrip t={s.t} values={s.battW} range={range} label="8 · 12 V battery output" unit="W" color={SIGNAL.lead} yMin={0} fill divider={divider} /></Card>}
      </div>
      <p className="text-xs text-muted">Strip 4 is total generator output: 12 V loads, bank refill and recovered energy together <InfoTip term="generator" />. Regeneration alone is not logged second by second; it appears only as a scenario total.</p>
    </div>
  );
}

function Legend() {
  return (
    <span className="hidden md:flex items-center gap-2.5 text-[11px] text-muted">
      {(['full', 'cut_short', 'denied', 'engine_cold'] as const).map((o) => (
        <span key={o} className="flex items-center gap-1"><i className="w-2.5 h-2.5 inline-block rounded-sm" style={{ background: OUTCOME_COLOR[o] }} />{OUTCOME_LABEL[o]}</span>
      ))}
    </span>
  );
}

function Lamp({ on, label, color }: { on: boolean; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 bg-soft">
      <span className="w-3 h-3 rounded-full transition-colors" style={{ background: on ? color : '#94A3B855', boxShadow: on ? `0 0 8px ${color}` : 'none' }} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function Read({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-line px-2 py-1.5 bg-soft">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="h-tech num text-xl leading-tight">{value} <span className="text-xs text-muted font-sans font-normal">{unit}</span></div>
    </div>
  );
}

function Instruments({ sc, showTemp }: { sc: ActiveScenario; showTemp?: boolean }) {
  const sec = useReplaySecond();
  const i = indexAt(sc, sec); const s = sc.series;
  const marks = [] as { v: number; color: string; label: string }[];
  if (sc.meta.bank) marks.push({ v: sc.meta.bank.v_min, color: SIGNAL.denied, label: 'Lower limit' });
  if (sc.meta.reserve_v) marks.push({ v: sc.meta.reserve_v, color: SIGNAL.uc, label: 'Reserve' });
  const temp = s.temp[i];
  return (
    <div>
      <div className="grid grid-cols-2 gap-1 justify-items-center">
        <Gauge value={s.speed[i]} min={0} max={60} label="Speed" unit="km/h" color={SIGNAL.speed} size={168} />
        <Gauge value={s.ucV[i]} min={0} max={26} label="Bank voltage" unit="V" color={SIGNAL.uc} digits={1} marks={marks} naText="No bank" size={168} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <Read label="Generator output" value={String(Math.round(s.genW[i]))} unit="W" />
        <Read label="Assist power" value={String(Math.round(s.assistW[i]))} unit="W" />
        <Lamp on={s.engineOn[i] === 1} label={s.engineOn[i] === 1 ? 'Engine running' : 'Engine off'} color={SIGNAL.full} />
        <Lamp on={s.assistW[i] > 0} label="Boost active" color={SIGNAL.full} />
        <Read label="Mode" value={sc.meta.mode ?? 'None'} unit="" />
        {showTemp && temp !== null ? <Read label="Engine temp (modelled)" value={temp.toFixed(0)} unit="°C" />
          : <Read label="Engine RPM" value="N/A" unit="not logged" />}
      </div>
    </div>
  );
}

function StatePanel({ sc }: { sc: ActiveScenario }) {
  const sec = useReplaySecond();
  const revealAll = useReplay((s) => s.revealAll);
  const { seek, setRevealAll } = useReplay.getState();
  const [t0, t1] = [useReplay((s) => s.t0), useReplay((s) => s.t1)];
  const st = inferState(sc, sec);
  const events = sc.events.filter((e) => e.t >= t0 && e.t <= t1);
  return (
    <>
      <Card title="Operating state">
        <div className="rounded-lg px-3 py-2 text-white h-tech text-xl !text-white" style={{ background: st.color }}>{st.label}</div>
        <p className="text-xs mt-2 leading-snug">{st.explain}</p>
        <p className="text-[10px] text-muted mt-2">State inferred from logged signals; the model does not log a state name.</p>
      </Card>
      <Card title="Boost requests" right={<span className="num text-muted">{events.length}</span>}>
        <div className="max-h-[205px] overflow-auto space-y-1 pr-1">
          {events.length === 0 && <p className="text-xs text-muted">No boost requests: this system has no electric assist.</p>}
          {events.map((e, k) => {
            const known = revealAll || sec >= e.end;
            return (
              <button key={k} onClick={() => { useReplay.setState({ playing: false }); seek(e.t); }}
                className={`w-full flex items-center justify-between gap-2 text-left text-xs rounded px-2 py-1 border ${Math.abs(sec - e.t) < 1 ? 'border-racing' : 'border-line'} hover:bg-soft`}>
                <span className="num">{e.t} s</span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2 h-2 rounded-full inline-block" style={{ background: known ? OUTCOME_COLOR[e.outcome] : '#94A3B8' }} />
                  {known ? OUTCOME_LABEL[e.outcome] : 'pending'}
                </span>
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted mt-2">
          <input type="checkbox" checked={revealAll} onChange={(e) => setRevealAll(e.target.checked)} />
          Show all outcomes now (retrospective annotation)
        </label>
      </Card>
    </>
  );
}
