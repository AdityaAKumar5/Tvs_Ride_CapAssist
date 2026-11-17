import type {
  BoostEvent, ColdResultRow, ColdScenario, DataBundle, Outcome, RawFiles, SensitivityRow, Series, Summary, WarmScenario,
} from '../types';
import { FILES } from './schemas';
import { count, num, parseCsv, type Row } from './parse';

function emptySeries(): Series {
  return { n: 0, t: [], speed: [], ucV: [], assistW: [], genW: [], fuel: [], engineOn: [], battW: [], soc: [], temp: [],
    gate: [], reserveMet: [], bankOn: [] };
}

function summaryFrom(o: Record<string, unknown>): Summary {
  return {
    fuelMl: num(o.fuel_ml), kmPerL: num(o.km_per_l), requests: count(o.boost_requests), full: count(o.boosts_full),
    cutShort: count(o.boosts_cut_short), denied: count(o.boosts_denied), engineCold: count(o.boosts_engine_cold),
    boostWh: num(o.boost_wh), regenWh: num(o.free_regen_wh), batteryOutWh: num(o.battery_out_wh),
    batteryPulses: num(o.battery_pulses), engineOffS: num(o.engine_off_s), ucVmin: num(o.uc_vmin), ucVmax: num(o.uc_vmax),
  };
}

function need(raw: RawFiles, name: string): string {
  const t = raw[name];
  if (t === undefined) throw new Error(`Data file not loaded: ${name}`);
  return t;
}

/** Build the typed bundle from raw file texts. Pure: used by the app and by the tests. */
export function buildBundle(raw: RawFiles): DataBundle {
  // ---------- warm package
  const wMeta = JSON.parse(need(raw, FILES.warmMeta));
  const warmScenarios: Record<string, WarmScenario> = {};
  const warmOrder: string[] = [];
  for (const s of wMeta.scenarios as Record<string, unknown>[]) {
    const id = String(s.case_id);
    warmOrder.push(id);
    warmScenarios[id] = { ...(s as unknown as WarmScenario), summary: summaryFrom(s.summary as Record<string, unknown>) };
  }
  // results.csv is the authority for warm summary numbers: it overrides the metadata copy.
  for (const r of parseCsv(FILES.warmResults, need(raw, FILES.warmResults))) {
    const sc = warmScenarios[r.id];
    if (!sc) continue;
    sc.summary = { ...summaryFrom(r as unknown as Record<string, unknown>), engineCold: 0 };
  }
  const warmSeries: Record<string, Series> = {};
  let warmSamples = 0;
  for (const r of parseCsv(FILES.warmSeries, need(raw, FILES.warmSeries))) {
    const s = (warmSeries[r.case_id] ??= emptySeries());
    s.t.push(count(r.time_s)); s.speed.push(count(r.speed_kmh)); s.ucV.push(num(r.uc_voltage_v));
    s.assistW.push(count(r.assist_electrical_w)); s.genW.push(count(r.generator_electrical_w));
    s.fuel.push(count(r.fuel_ml_s)); s.engineOn.push(count(r.engine_on)); s.battW.push(count(r.battery_output_w));
    s.soc.push(num(r.battery_soc_pct)); s.temp.push(null); s.gate.push(null); s.reserveMet.push(null); s.bankOn.push(null);
    s.n++; warmSamples++;
  }
  const warmEvents: Record<string, BoostEvent[]> = {};
  for (const r of parseCsv(FILES.warmEvents, need(raw, FILES.warmEvents))) {
    const t = count(r.time_s);
    (warmEvents[r.case_id] ??= []).push({ t, end: num(r.end_time_s) ?? t, outcome: r.event_outcome as Outcome,
      wh: count(r.boost_energy_wh), phase: 'warm' });
  }

  // ---------- cold package
  const cMeta = JSON.parse(need(raw, FILES.coldMeta));
  const coldScenarios: Record<string, ColdScenario> = {};
  const coldOrder: string[] = [];
  for (const s of cMeta.scenarios as Record<string, unknown>[]) {
    const key = String(s.case_key);
    coldOrder.push(key);
    const c = s.cold as Record<string, unknown>; const h = s.hot as Record<string, unknown>;
    coldScenarios[key] = {
      ...(s as unknown as ColdScenario),
      cold: { ...summaryFrom(c), batteryDeficitEndWh: num(c.battery_deficit_end_wh) },
      hot: { ...summaryFrom(h), batteryDeficitEndWh: num(h.battery_deficit_end_wh) },
    };
  }
  const coldSeries: Record<string, Series> = {};
  let coldSamples = 0;
  for (const r of parseCsv(FILES.coldSeries, need(raw, FILES.coldSeries))) {
    const s = (coldSeries[r.case_key] ??= emptySeries());
    s.t.push(count(r.elapsed_from_engine_start_s)); s.speed.push(count(r.speed_kmh)); s.ucV.push(num(r.ultracap_voltage_v));
    s.assistW.push(count(r.assist_electrical_w)); s.genW.push(count(r.generator_total_electrical_w));
    s.fuel.push(count(r.fuel_ml_per_s)); s.engineOn.push(count(r.engine_on)); s.battW.push(count(r.battery_output_w));
    s.soc.push(num(r.battery_soc_pct)); s.temp.push(num(r.engine_temperature_c)); s.gate.push(num(r.engine_warm_gate));
    s.reserveMet.push(num(r.bank_reserve_energy_met)); s.bankOn.push(num(r.bank_connected));
    s.n++; coldSamples++;
  }
  const coldEvents: Record<string, BoostEvent[]> = {};
  for (const r of parseCsv(FILES.coldEvents, need(raw, FILES.coldEvents))) {
    const t = count(r.elapsed_from_engine_start_s);
    (coldEvents[r.case_key] ??= []).push({ t, end: num(r.end_time_s) ?? t, outcome: r.event_outcome as Outcome,
      wh: count(r.boost_energy_wh), phase: r.phase === 'hot' ? 'hot' : 'cold' });
  }
  const coldResults: ColdResultRow[] = parseCsv(FILES.coldResults, need(raw, FILES.coldResults)).map((r: Row) => ({
    case: r.case, id: r.id, parked_h: num(r.parked_h), bank_v_at_key_on: num(r.bank_v_at_key_on),
    bank_switch_closes_s: num(r.bank_switch_closes_s), bank_at_reserve_s: num(r.bank_at_reserve_s),
    engine_warm_s: num(r.engine_warm_s), cold_boost_requests: count(r.cold_boost_requests),
    cold_refused_engine_cold: count(r.cold_refused_engine_cold), cold_boosts_full: count(r.cold_boosts_full),
    cold_boosts_cut_short: count(r.cold_boosts_cut_short), cold_boosts_denied: count(r.cold_boosts_denied),
    cold_engine_off_s: num(r.cold_engine_off_s), cold_battery_out_wh: num(r.cold_battery_out_wh),
    cold_battery_pulses: num(r.cold_battery_pulses), precharge_from_battery_wh: num(r.precharge_from_battery_wh),
    cold_fuel_ml: num(r.cold_fuel_ml), hot_fuel_ml: num(r.hot_fuel_ml), weighted_km_per_l: num(r.weighted_km_per_l),
  }));

  // ---------- precomputed warm stress cases (optional file)
  let sensitivity: SensitivityRow[] = [];
  if (raw[FILES.sensitivity]) {
    sensitivity = parseCsv(FILES.sensitivity, raw[FILES.sensitivity]).map((r) => ({
      variation_key: r.variation_key, variation_label: r.variation_label, case_id: r.case_id, fuel_ml: num(r.fuel_ml),
      km_per_l: num(r.km_per_l), boost_requests: count(r.boost_requests), boosts_full: count(r.boosts_full),
      boosts_cut_short: count(r.boosts_cut_short), boosts_denied: count(r.boosts_denied), free_regen_wh: num(r.free_regen_wh),
      battery_out_wh: num(r.battery_out_wh), battery_pulses: num(r.battery_pulses), uc_vmin: num(r.uc_vmin), uc_vmax: num(r.uc_vmax),
    }));
  }

  return {
    warm: { order: warmOrder, scenarios: warmScenarios, series: warmSeries, events: warmEvents,
      info: { model: String(wMeta.model ?? ''), cycle: String(wMeta.cycle ?? ''), duration: count(wMeta.cycle_duration_s),
        distanceM: count(wMeta.cycle_distance_m) } },
    cold: { order: coldOrder, scenarios: coldScenarios, series: coldSeries, events: coldEvents, results: coldResults,
      assumptions: (cMeta.assumptions ?? {}) as Record<string, unknown>, weighting: String(cMeta.weighting ?? '') },
    sensitivity,
    counts: { warmScenarios: warmOrder.length, coldScenarios: coldOrder.length, warmSamples, coldSamples },
  };
}
