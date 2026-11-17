import type { Condition, DataBundle, Summary } from '../types';
import type { AvailRow } from '../charts/AvailabilityChart';
import type { DutyRow } from '../charts/BatteryDutyChart';

interface Entry { key: string; name: string; short: string; family: string; profile: string | null; summary: Summary; }

/** Scenarios shown in summary charts for a condition. Sensitivity cases stay on the Cold Start page. */
export function entriesFor(data: DataBundle, condition: Condition, includeSensitivity = false): Entry[] {
  if (condition === 'warm') {
    return data.warm.order.map((id) => { const s = data.warm.scenarios[id];
      return { key: id, name: s.short_name, short: s.short_name, family: s.family, profile: s.boost_profile, summary: s.summary }; });
  }
  return data.cold.order.filter((k) => includeSensitivity || data.cold.scenarios[k].group !== 'sensitivity').map((k) => {
    const s = data.cold.scenarios[k];
    const name = s.group === 'baseline' ? s.short_name : s.case_label.replace('CapAssist Y ', '').replace(', parked', ' ·');
    return { key: k, name, short: name, family: s.family, profile: s.boost_profile, summary: condition === 'cold' ? s.cold : s.hot };
  });
}

export function availRows(data: DataBundle, condition: Condition, selected?: string, keys?: string[]): AvailRow[] {
  return entriesFor(data, condition, true).filter((e) => !keys || keys.includes(e.key)).filter((e) => keys || !isSensitivity(data, condition, e.key))
    .map((e) => ({ key: e.key, name: e.name, full: e.summary.full, cutShort: e.summary.cutShort, denied: e.summary.denied,
      engineCold: e.summary.engineCold, requests: e.summary.requests, profile: e.profile, selected: e.key === selected }));
}

function isSensitivity(data: DataBundle, condition: Condition, key: string): boolean {
  return condition !== 'warm' && data.cold.scenarios[key]?.group === 'sensitivity';
}

export function dutyRows(data: DataBundle, condition: Condition): DutyRow[] {
  return entriesFor(data, condition).filter((e) => e.family !== 'conventional')
    .map((e) => ({ key: e.key, name: e.short, wh: e.family === 'lithium' ? null : e.summary.batteryOutWh, pulses: e.summary.batteryPulses, family: e.family }));
}
