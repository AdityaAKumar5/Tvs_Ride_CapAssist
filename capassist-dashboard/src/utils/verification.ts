import type { DataBundle } from '../types';

export interface Check { group: string; name: string; expected: string; actual: string; pass: boolean; }

const fr = (full: number, req: number) => `${full}/${req}`;

/** The engineering verification tests the dashboard must pass against whatever data is loaded. */
export function runChecks(d: DataBundle): Check[] {
  const out: Check[] = [];
  const add = (group: string, name: string, expected: string, actual: string) =>
    out.push({ group, name, expected, actual, pass: expected === actual });

  const w = (id: string) => { const s = d.warm.scenarios[id]?.summary; return s ? fr(s.full, s.requests) : 'missing'; };
  add('Warm scenarios', 'Stock, 34 W acceptance (B1)', '4/9', w('B1'));
  add('Warm scenarios', 'Stock, 68 W acceptance (B2)', '6/9', w('B2'));
  add('Warm scenarios', 'Stock, 120 W acceptance (B3)', '7/9', w('B3'));
  add('Warm scenarios', 'CapAssist Y Eco (D)', '10/10', w('D'));
  add('Warm scenarios', 'CapAssist Y Power (DP)', '9/9', w('DP'));
  add('Warm scenarios', 'High-power lithium, Eco (F)', '10/10', w('F'));

  const c = (key: string) => { const s = d.cold.scenarios[key]?.cold; return s ? fr(s.full, s.requests) : 'missing'; };
  add('Cold scenarios', 'Overnight CapAssist Eco', '9/10', c('D_park_12h'));
  add('Cold scenarios', 'One-week CapAssist Eco', '9/10', c('D_park_168h'));
  add('Cold scenarios', 'One-month CapAssist Eco', '9/10', c('D_park_720h'));
  add('Cold scenarios', 'One-month CapAssist Power', '8/9', c('DP_park_720h'));

  add('Sensitivity', 'Pre-charge at 2.5 A, Eco', '7/10', c('D_720h_precharge_2p5a'));
  add('Sensitivity', 'Pre-charge at 10 A, Eco', '9/10', c('D_720h_precharge_10a'));
  add('Sensitivity', 'Engine warms half as fast, Eco', '6/10', c('D_720h_warm_slow'));
  add('Sensitivity', 'Ambient 15 C, Eco', '7/10', c('D_720h_ambient_15c'));

  add('Dataset', 'Warm scenarios', '12', String(d.counts.warmScenarios));
  add('Dataset', 'Cold scenarios', '17', String(d.counts.coldScenarios));
  const warmLens = new Set(Object.values(d.warm.series).map((s) => s.n));
  add('Dataset', 'Samples per warm scenario', '600', [...warmLens].join(', '));
  const coldLens = new Set(Object.values(d.cold.series).map((s) => s.n));
  add('Dataset', 'Samples per cold scenario', '1200', [...coldLens].join(', '));
  const boundaryOk = Object.values(d.cold.series).every((s) => s.t[599] === 600 && s.t[600] === 601);
  add('Dataset', 'Cold/hot phase boundary at 600 s', 'ok', boundaryOk ? 'ok' : 'wrong');
  // every event must sit on a second where the time series flags a request
  let mapped = true;
  for (const id of d.warm.order) {
    const s = d.warm.scenarios[id].summary;
    const n = (d.warm.events[id] ?? []).length;
    if (n !== s.requests) mapped = false;
  }
  for (const k of d.cold.order) {
    const sc = d.cold.scenarios[k];
    const n = (d.cold.events[k] ?? []).length;
    if (n !== sc.cold.requests + sc.hot.requests) mapped = false;
  }
  add('Dataset', 'Boost events match request counts', 'ok', mapped ? 'ok' : 'mismatch');
  const conv = d.warm.scenarios['A']?.summary;
  add('Dataset', 'Conventional vehicle shows N/A, not 0%', 'N/A', conv && conv.requests === 0 ? 'N/A' : 'has requests');
  return out;
}
