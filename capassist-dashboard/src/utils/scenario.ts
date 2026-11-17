import type { ActiveScenario, Condition, DataBundle, Summary } from '../types';

export const CONDITION_LABEL: Record<Condition, string> = {
  warm: 'Warm steady state', cold: 'Cold pass after parking', hot: 'Hot pass after the cold pass',
};

/** A selection string: "warm:D", "cold:D_park_12h" or "hot:D_park_12h". */
export function selKey(condition: Condition, key: string): string { return `${condition}:${key}`; }

export function parseSel(sel: string): { condition: Condition; key: string } {
  const i = sel.indexOf(':');
  return { condition: sel.slice(0, i) as Condition, key: sel.slice(i + 1) };
}

/** Resolve a selection to everything a page needs. Returns null if the data does not hold it. */
export function resolveScenario(data: DataBundle, condition: Condition, key: string): ActiveScenario | null {
  if (condition === 'warm') {
    const meta = data.warm.scenarios[key]; const series = data.warm.series[key];
    if (!meta || !series) return null;
    return { key, label: meta.case_name, shortLabel: meta.short_name, condition, conditionLabel: CONDITION_LABEL.warm,
      meta, series, events: data.warm.events[key] ?? [], summary: meta.summary, range: [1, series.n], hasBank: meta.store_type === 'uc' };
  }
  const meta = data.cold.scenarios[key]; const series = data.cold.series[key];
  if (!meta || !series) return null;
  const half = Math.floor(series.n / 2);
  const range: [number, number] = condition === 'cold' ? [1, half] : [half + 1, series.n];
  const events = (data.cold.events[key] ?? []).filter((e) => e.phase === condition);
  const summary: Summary = condition === 'cold' ? meta.cold : meta.hot;
  return { key, label: meta.case_label, shortLabel: meta.case_label, condition, conditionLabel: CONDITION_LABEL[condition],
    meta, cold: meta, series, events, summary, range, hasBank: meta.store_type === 'uc' };
}

/** When the operating condition changes, keep the nearest equivalent scenario selected. */
export function mapSelection(data: DataBundle, to: Condition, warmId: string, coldKey: string): { warmId: string; coldKey: string } {
  if (to === 'warm') {
    const id = data.cold.scenarios[coldKey]?.case_id;
    return { warmId: id && data.warm.scenarios[id] ? id : warmId, coldKey };
  }
  const current = data.cold.scenarios[coldKey];
  if (current && current.case_id === warmId) return { warmId, coldKey };
  const match = data.cold.order.find((k) => data.cold.scenarios[k].case_id === warmId && data.cold.scenarios[k].group !== 'sensitivity');
  return { warmId, coldKey: match ?? coldKey };
}

export function parkLabel(h: number): string {
  if (h < 48) return `${h} hours`;
  if (h === 60) return '60 hours';
  if (h === 168) return '1 week';
  if (h === 720) return '1 month';
  return `${Math.round(h / 24)} days`;
}

/** Re-base a scenario to a local 1..N axis, so two passes of different origin can share one replay cursor. */
export function localise(sc: ActiveScenario): ActiveScenario {
  const [a, b] = sc.range; const first = sc.series.t[0]; const i0 = a - first; const i1 = b - first + 1; const off = a - 1;
  const cut = <T,>(x: T[]) => x.slice(i0, i1);
  const s = sc.series;
  return { ...sc, range: [1, b - a + 1],
    series: { n: i1 - i0, t: cut(s.t).map((x) => x - off), speed: cut(s.speed), ucV: cut(s.ucV), assistW: cut(s.assistW), genW: cut(s.genW),
      fuel: cut(s.fuel), engineOn: cut(s.engineOn), battW: cut(s.battW), soc: cut(s.soc), temp: cut(s.temp), gate: cut(s.gate),
      reserveMet: cut(s.reserveMet), bankOn: cut(s.bankOn) },
    events: sc.events.map((e) => ({ ...e, t: e.t - off, end: e.end - off })) };
}
