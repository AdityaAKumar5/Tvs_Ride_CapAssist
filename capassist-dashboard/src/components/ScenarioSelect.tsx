import type { DataBundle } from '../types';
import { useApp } from '../hooks/useApp';
import { selKey } from '../utils/scenario';
import { Select } from './ui';

function warmGroups(data: DataBundle) {
  const g: Record<string, string[]> = { Conventional: [], 'Stock iGO Assist': [], CapAssist: [], 'Alternative technology': [] };
  for (const id of data.warm.order) {
    const f = data.warm.scenarios[id].family;
    g[f === 'conventional' ? 'Conventional' : f === 'stock' ? 'Stock iGO Assist' : f === 'lithium' ? 'Alternative technology' : 'CapAssist'].push(id);
  }
  return g;
}
function coldGroups(data: DataBundle) {
  const g: Record<string, string[]> = { Baselines: [], 'CapAssist after parking': [], 'Sensitivity cases': [] };
  for (const k of data.cold.order) {
    const grp = data.cold.scenarios[k].group;
    g[grp === 'baseline' ? 'Baselines' : grp === 'parking' ? 'CapAssist after parking' : 'Sensitivity cases'].push(k);
  }
  return g;
}

/** Global scenario selector: lists the scenarios that exist for the current operating condition. */
export function ScenarioSelect() {
  const data = useApp((s) => s.data);
  const condition = useApp((s) => s.condition);
  const warmId = useApp((s) => s.warmId);
  const coldKey = useApp((s) => s.coldKey);
  const setScenario = useApp((s) => s.setScenario);
  if (!data) return null;
  if (condition === 'warm') {
    return (
      <Select label="Scenario" value={warmId} onChange={setScenario}>
        {Object.entries(warmGroups(data)).map(([g, ids]) => (
          <optgroup key={g} label={g}>{ids.map((id) => <option key={id} value={id}>{data.warm.scenarios[id].case_name}</option>)}</optgroup>
        ))}
      </Select>
    );
  }
  return (
    <Select label="Scenario" value={coldKey} onChange={setScenario}>
      {Object.entries(coldGroups(data)).map(([g, keys]) => (
        <optgroup key={g} label={g}>{keys.map((k) => <option key={k} value={k}>{data.cold.scenarios[k].case_label}</option>)}</optgroup>
      ))}
    </Select>
  );
}

/** Selector over every scenario in every condition, for side-by-side comparison. */
export function SelSelect({ value, onChange, label, warmOnly }: { value: string; onChange: (v: string) => void; label: string; warmOnly?: boolean }) {
  const data = useApp((s) => s.data);
  if (!data) return null;
  return (
    <Select label={label} value={value} onChange={onChange}>
      <optgroup label="Warm steady state">
        {data.warm.order.map((id) => <option key={id} value={selKey('warm', id)}>{data.warm.scenarios[id].case_name}</option>)}
      </optgroup>
      {!warmOnly && <optgroup label="Cold pass after parking">
        {data.cold.order.map((k) => <option key={k} value={selKey('cold', k)}>{data.cold.scenarios[k].case_label}</option>)}
      </optgroup>}
      {!warmOnly && <optgroup label="Hot pass after the cold pass">
        {data.cold.order.map((k) => <option key={k} value={selKey('hot', k)}>{data.cold.scenarios[k].case_label}</option>)}
      </optgroup>}
    </Select>
  );
}
