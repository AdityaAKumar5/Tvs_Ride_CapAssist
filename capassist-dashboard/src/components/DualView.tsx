import { useMemo } from 'react';
import type { ActiveScenario } from '../types';
import { TimeStrip } from '../charts/TimeStrip';
import { useReplay, useReplayRange, useReplaySecond } from '../hooks/useReplay';
import { ReplayControls } from './ReplayControls';
import { Card, Chip, Notice } from './ui';
import { localise } from '../utils/scenario';
import { indexAt } from '../utils/stateInfer';
import { OUTCOME_COLOR, OUTCOME_LABEL, SIGNAL } from '../styles/theme';

/** Two scenarios replayed against one shared cursor, to show why the model gives different results. */
export function DualView({ a, b, compact }: { a: ActiveScenario; b: ActiveScenario; compact?: boolean }) {
  const la = useMemo(() => localise(a), [a]);
  const lb = useMemo(() => localise(b), [b]);
  const n = Math.min(la.series.n, lb.series.n);
  useReplayRange(1, n);
  const differentCondition = a.condition !== b.condition;
  const differentProfile = a.meta.boost_profile !== b.meta.boost_profile;
  return (
    <div className="space-y-3">
      <Card pad={false}><div className="px-4 py-2.5"><ReplayControls scenario={la} compact /></div></Card>
      {differentCondition && <Notice tone="warn"><b>Different starting conditions.</b> One side is {a.conditionLabel.toLowerCase()} and the other is {b.conditionLabel.toLowerCase()}. They do not start from the same engine temperature or store state.</Notice>}
      {differentProfile && <Notice tone="warn"><b>The assist profiles differ.</b> {profileText(a)} on the left, {profileText(b)} on the right. Requests and delivered energy are not equivalent.</Notice>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Side sc={la} n={n} tag="A" compact={compact} />
        <Side sc={lb} n={n} tag="B" compact={compact} />
      </div>
    </div>
  );
}

function profileText(sc: ActiveScenario): string {
  return sc.meta.boost_profile === 'tapered_3s_1s' ? 'a tapered 3 s + 1 s boost' : sc.meta.boost_profile === 'sustained_8s' ? 'a sustained boost of up to 8 s' : 'no assist';
}

function Side({ sc, n, tag, compact }: { sc: ActiveScenario; n: number; tag: string; compact?: boolean }) {
  const s = sc.series; const range: [number, number] = [1, n];
  const store = sc.hasBank ? { values: s.ucV, label: 'Energy store: bank voltage', unit: 'V', digits: 1 }
    : sc.meta.store_type === 'pb' ? { values: s.soc, label: 'Energy store: battery charge', unit: '%', digits: 1 }
    : { values: s.ucV, label: 'Energy store state', unit: '', digits: 0 };
  return (
    <Card title={<><span className="bg-navy text-white rounded px-1.5 text-xs">{tag}</span>{sc.label}</>} right={<Chip>{sc.conditionLabel}</Chip>}>
      <Status sc={sc} />
      <div className="space-y-1 mt-2">
        <TimeStrip t={s.t} values={s.speed} range={range} label="Speed" unit="km/h" color={SIGNAL.speed} yMin={0} yMax={60} events={sc.events} height={96} />
        <TimeStrip t={s.t} values={s.assistW} range={range} label="Electrical assist" unit="W" color={SIGNAL.assist} yMin={0} yMax={450} fill height={76} />
        <TimeStrip t={s.t} values={store.values} range={range} label={store.label} unit={store.unit} color={sc.hasBank ? SIGNAL.uc : SIGNAL.lead} digits={store.digits} height={84}
          refLines={sc.meta.reserve_v ? [{ y: sc.meta.reserve_v, label: 'reserve', color: SIGNAL.uc }] : undefined}
          naText={sc.meta.store_type === 'li' ? 'N/A: lithium state is not exported as a signal' : 'N/A: no energy store for assist'} />
        {!compact && <TimeStrip t={s.t} values={s.engineOn as (number | null)[]} range={range} label="Engine on (1) / off (0)" unit="" color={SIGNAL.lead} yMin={0} yMax={1.2} stepped fill height={62} />}
        <TimeStrip t={s.t} values={s.battW} range={range} label="12 V battery output" unit="W" color="#475569" yMin={0} yMax={450} fill height={76} />
        {!compact && <TimeStrip t={s.t} values={s.fuel} range={range} label="Fuel rate" unit="mL/s" color={SIGNAL.fuel} yMin={0} digits={3} height={76} />}
      </div>
    </Card>
  );
}

function Status({ sc }: { sc: ActiveScenario }) {
  const sec = useReplaySecond();
  const revealAll = useReplay((s) => s.revealAll);
  const i = indexAt(sc, sec); const s = sc.series;
  const done = sc.events.filter((e) => (revealAll ? e.t <= sec : e.end <= sec));
  const last = done[done.length - 1];
  const count = (o: string) => done.filter((e) => e.outcome === o).length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Chip color={s.assistW[i] > 0 ? SIGNAL.full : SIGNAL.inactive}>{s.assistW[i] > 0 ? `Assisting ${Math.round(s.assistW[i])} W` : 'No assist'}</Chip>
      <Chip color={s.engineOn[i] ? SIGNAL.full : SIGNAL.inactive}>{s.engineOn[i] ? 'Engine on' : 'Engine off'}</Chip>
      <Chip>So far: <b className="num">{count('full')}</b> full · <b className="num">{count('denied')}</b> denied · <b className="num">{count('cut_short')}</b> cut · <b className="num">{count('engine_cold')}</b> cold</Chip>
      {last && <Chip color={OUTCOME_COLOR[last.outcome]}>Last request ({last.t} s): {OUTCOME_LABEL[last.outcome]}</Chip>}
    </div>
  );
}
