import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildBundle } from '../src/data/build';
import { ALL_FILES } from '../src/data/schemas';
import { num, parseCsv, validateFile } from '../src/data/parse';
import { availability, bankCalc, energyCurve } from '../src/utils/calc';
import { runChecks } from '../src/utils/verification';
import { localise, mapSelection, resolveScenario } from '../src/utils/scenario';
import { inferState } from '../src/utils/stateInfer';
import type { DataBundle, RawFiles } from '../src/types';

let raw: RawFiles; let data: DataBundle;
beforeAll(() => {
  raw = {};
  for (const f of ALL_FILES) raw[f] = readFileSync(resolve(__dirname, '../public/data', f), 'utf8');
  data = buildBundle(raw);
});

describe('required engineering verification tests', () => {
  it('passes every check against the bundled data', () => {
    const failed = runChecks(data).filter((c) => !c.pass);
    expect(failed.map((c) => `${c.name}: expected ${c.expected}, got ${c.actual}`)).toEqual([]);
  });
  it('has 12 warm scenarios of 600 samples and 17 cold scenarios of 1200 samples', () => {
    expect(data.counts).toEqual({ warmScenarios: 12, coldScenarios: 17, warmSamples: 7200, coldSamples: 20400 });
  });
  it('puts the cold/hot boundary at 600 s and keeps events inside their phase', () => {
    for (const k of data.cold.order) {
      expect(data.cold.series[k].t[599]).toBe(600);
      expect(data.cold.series[k].t[600]).toBe(601);
      for (const e of data.cold.events[k] ?? []) expect(e.phase === 'cold' ? e.t <= 600 : e.t > 600).toBe(true);
    }
  });
  it('maps every boost event to a second the time series flags as a request, with the outcome known later or at once', () => {
    for (const id of data.warm.order) for (const e of data.warm.events[id] ?? []) { expect(e.end).toBeGreaterThanOrEqual(e.t); expect(e.t).toBeLessThanOrEqual(600); }
  });
});

describe('availability and missing values', () => {
  it('reports N/A, not 0%, when there are no boost requests', () => {
    expect(availability(0, 0)).toBeNull();
    const conv = data.warm.scenarios.A.summary;
    expect(availability(conv.full, conv.requests)).toBeNull();
  });
  it('computes 100 x full / requests', () => {
    expect(availability(6, 9)).toBeCloseTo(66.667, 2);
    expect(availability(10, 10)).toBe(100);
  });
  it('treats "-", blanks and null as missing, never zero', () => {
    expect(num('-')).toBeNull(); expect(num('')).toBeNull(); expect(num(null)).toBeNull(); expect(num('0')).toBe(0); expect(num('18.1')).toBe(18.1);
    const conv = data.cold.results.find((r) => r.id === 'A')!;
    expect(conv.bank_v_at_key_on).toBeNull(); expect(conv.bank_at_reserve_s).toBeNull();
    expect(data.warm.series.A.ucV.every((v) => v === null)).toBe(true);
  });
  it('separates cold-gated requests from energy-related denials', () => {
    const eco = data.cold.scenarios.D_park_12h.cold;
    expect(eco.engineCold).toBe(1); expect(eco.denied).toBe(0); expect(eco.full + eco.engineCold).toBe(eco.requests);
    const stock = data.cold.scenarios.B2_stock.cold;
    expect(stock.engineCold).toBe(1); expect(stock.denied).toBeGreaterThan(0);
  });
});

describe('schema validation', () => {
  it('refuses a file with a missing column and names it', () => {
    const bad = raw['results.csv'].replace('boosts_full', 'boosts_ok');
    const v = validateFile('results.csv', bad);
    expect(v.ok).toBe(false); expect(v.message).toContain('boosts_full');
    expect(() => parseCsv('results.csv', bad)).toThrow();
  });
  it('accepts the bundled files', () => { for (const f of ALL_FILES) expect(validateFile(f, raw[f]).ok).toBe(true); });
  it('lets results.csv override the metadata copy of a warm summary', () => {
    const edited = { ...raw, 'results.csv': raw['results.csv'].replace(/^D,("[^"]*"),82\.16,/m, 'D,$1,99.99,') };
    expect(buildBundle(edited).warm.scenarios.D.summary.fuelMl).toBe(99.99);
  });
});

describe('ultracapacitor calculations', () => {
  const base = { cells: 10, cellF: 350, vMax: 25, vMin: 12.5, esrMilliOhm: 32, boostW: 432, boostS: 3.5, efficiency: 1, vNow: 25 };
  it('gives 35 F and 2.28 Wh usable for 10 x 350 F between 12.5 and 25 V', () => {
    const o = bankCalc(base);
    expect(o.ceq).toBeCloseTo(35, 6); expect(o.eUsableWh).toBeCloseTo(2.279, 2); expect(o.headroomWh).toBeCloseTo(0, 6);
    expect(o.boostNeedWh).toBeCloseTo(0.42, 2);
  });
  it('gives 43.75 F for 8 cells and a curve that starts at zero', () => {
    expect(bankCalc({ ...base, cells: 8, vMax: 20, vNow: 20 }).ceq).toBeCloseTo(43.75, 6);
    const c = energyCurve(base); expect(c[0].wh).toBe(0); expect(c[c.length - 1].wh).toBeCloseTo(2.279, 2);
  });
});

describe('scenario handling', () => {
  it('resolves warm, cold and hot selections with the right range', () => {
    expect(resolveScenario(data, 'warm', 'D')!.range).toEqual([1, 600]);
    expect(resolveScenario(data, 'cold', 'D_park_12h')!.range).toEqual([1, 600]);
    const hot = resolveScenario(data, 'hot', 'D_park_12h')!;
    expect(hot.range).toEqual([601, 1200]); expect(hot.events.every((e) => e.t > 600)).toBe(true);
    expect(hot.summary.full).toBe(10);
  });
  it('re-bases a hot pass to a local 1..600 axis', () => {
    const l = localise(resolveScenario(data, 'hot', 'D_park_12h')!);
    expect(l.series.n).toBe(600); expect(l.series.t[0]).toBe(1); expect(l.events.every((e) => e.t >= 1 && e.t <= 600)).toBe(true);
  });
  it('keeps the equivalent scenario when the condition changes', () => {
    expect(mapSelection(data, 'cold', 'B2', 'D_park_12h').coldKey).toBe('B2_stock');
    expect(mapSelection(data, 'warm', 'D', 'DP_park_720h').warmId).toBe('DP');
  });
  it('infers states from logged signals', () => {
    const sc = resolveScenario(data, 'cold', 'D_park_12h')!;
    expect(inferState(sc, 75).id).toBe('cold');           // first request, refused by the temperature gate
    expect(inferState(sc, 5).id === 'idle' || inferState(sc, 5).id === 'off').toBe(true);
    const warm = resolveScenario(data, 'warm', 'D')!;
    expect(inferState(warm, 76).id).toBe('assist');
  });
});
