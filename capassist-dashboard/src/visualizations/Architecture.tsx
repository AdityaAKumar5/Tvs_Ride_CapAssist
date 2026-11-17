import { useMemo } from 'react';
import { SIGNAL } from '../styles/theme';

export type Option = 'X' | 'Y';
type Flow = [edge: string, dir: 1 | -1];
type Pt = [number, number];

interface NodeDef { id: string; x: number; y: number; title: string; sub?: string; added?: boolean; }
interface EdgeDef { id: string; pts: Pt[]; label?: string; at?: Pt; anchor?: 'start' | 'middle' | 'end'; kind: 'mech' | 'elec' | 'ctrl' | 'fallback'; }

const W = 150; const H = 58;
const MECH: NodeDef[] = [
  { id: 'isg', x: 20, y: 24, title: 'Starter generator (ISG)', sub: 'on the crankshaft' },
  { id: 'engine', x: 220, y: 24, title: 'Petrol engine', sub: 'crankshaft' },
  { id: 'clutch', x: 420, y: 24, title: 'Clutch' },
  { id: 'gearbox', x: 620, y: 24, title: 'Gearbox', sub: '5-speed' },
  { id: 'wheel', x: 820, y: 24, title: 'Rear wheel' },
];
const MECH_EDGES: EdgeDef[] = [
  { id: 'm1', pts: [[170, 53], [220, 53]], kind: 'mech' }, { id: 'm2', pts: [[370, 53], [420, 53]], kind: 'mech' },
  { id: 'm3', pts: [[570, 53], [620, 53]], kind: 'mech' }, { id: 'm4', pts: [[770, 53], [820, 53]], kind: 'mech' },
  { id: 'e1', pts: [[70, 82], [70, 160]], label: '3-phase', at: [62, 114], anchor: 'end', kind: 'elec' },
];

const LAYOUT: Record<Option, { nodes: NodeDef[]; edges: EdgeDef[] }> = {
  Y: {
    nodes: [...MECH,
      { id: 'ctrl', x: 20, y: 160, title: 'ISG controller / inverter', sub: 're-rated for 25 V', added: true },
      { id: 'uc', x: 220, y: 160, title: 'Ultracapacitor bank', sub: 'fused, switched · 12.5–25 V', added: true },
      { id: 'dcdc', x: 420, y: 160, title: 'Step-down DC–DC', sub: 'one-way, to 12 V', added: true },
      { id: 'batt', x: 620, y: 160, title: '12 V battery', sub: 'existing, unchanged' },
      { id: 'loads', x: 820, y: 160, title: 'ECU · lights · fuel pump', sub: '12 V loads' },
      { id: 'cam', x: 20, y: 300, title: 'CapAssist control', sub: 'modes · reserve · faults', added: true },
      { id: 'pre', x: 420, y: 300, title: 'Pre-charge stage', sub: 'current-limited', added: true }],
    edges: [...MECH_EDGES,
      { id: 'e2', pts: [[170, 189], [220, 189]], kind: 'elec' },
      { id: 'e3', pts: [[370, 189], [420, 189]], kind: 'elec' },
      { id: 'e4', pts: [[570, 189], [620, 189]], label: '12 V', kind: 'elec' },
      { id: 'e5', pts: [[770, 189], [820, 189]], kind: 'elec' },
      { id: 'p1', pts: [[695, 218], [695, 329], [570, 329]], label: 'pre-charge path', at: [632, 322], kind: 'elec' },
      { id: 'p2', pts: [[420, 329], [295, 329], [295, 218]], kind: 'elec' },
      { id: 'f1', pts: [[660, 160], [660, 122], [130, 122], [130, 160]], label: 'protection and fallback path', at: [395, 115], kind: 'fallback' },
      { id: 'c1', pts: [[95, 300], [95, 218]], kind: 'ctrl' },
      { id: 'c2', pts: [[170, 345], [420, 345]], kind: 'ctrl' }],
  },
  X: {
    nodes: [...MECH,
      { id: 'ctrl', x: 20, y: 160, title: 'Stock ISG controller', sub: '12 V, unchanged' },
      { id: 'batt', x: 220, y: 160, title: '12 V battery', sub: 'on the 12 V bus' },
      { id: 'loads', x: 420, y: 160, title: 'ECU · lights · fuel pump', sub: 'on the 12 V bus' },
      { id: 'dcdc', x: 620, y: 160, title: 'Bidirectional DC–DC', sub: 'also pre-charges the bank', added: true },
      { id: 'uc', x: 820, y: 160, title: 'Ultracapacitor bank', sub: 'fused, switched · 12.5–25 V', added: true },
      { id: 'cam', x: 20, y: 300, title: 'CapAssist control', sub: 'modes · reserve · faults', added: true }],
    edges: [...MECH_EDGES,
      { id: 'b1', pts: [[170, 189], [220, 189]], kind: 'elec' },
      { id: 'b2', pts: [[370, 189], [420, 189]], kind: 'elec' },
      { id: 'b3', pts: [[570, 189], [620, 189]], kind: 'elec' },
      { id: 'e3', pts: [[770, 189], [820, 189]], kind: 'elec' },
      { id: 'c1', pts: [[95, 300], [95, 218]], kind: 'ctrl' },
      { id: 'c2', pts: [[170, 329], [695, 329], [695, 218]], kind: 'ctrl' }],
  },
};

const DRIVE: Flow[] = [['m2', 1], ['m3', 1], ['m4', 1]];
const OVERRUN: Flow[] = [['m4', -1], ['m3', -1], ['m2', -1]];
const GEN: Flow[] = [['m1', -1], ['e1', 1]];
const MOTOR: Flow[] = [['e1', -1], ['m1', 1]];

export interface StateDef {
  id: string; label: string; color: string; what: string; why: string;
  flows: Record<Option, Flow[]>; off?: Record<Option, string[]>; note?: Partial<Record<Option, string>>;
}

export const STATES: StateDef[] = [
  { id: 'parked', label: 'Parked / Key Off', color: SIGNAL.inactive,
    what: 'Nothing flows. The bank keeps its charge and slowly leaks it. The balancing resistors are disconnected so they do not drain it.',
    why: 'Holding the bank up from the 12 V battery while parked would drain a battery that already needs regular riding to stay healthy.',
    flows: { X: [], Y: [] } },
  { id: 'key_on', label: 'Key On', color: SIGNAL.lead,
    what: 'The 12 V battery wakes the ECU, lights and fuel pump, as on the stock bike. The controller reads the bank voltage.',
    why: 'The controller must know whether the bank is above 12.5 V before it connects it.',
    flows: { X: [['b2', 1]], Y: [['e5', 1]] } },
  { id: 'precharge', label: 'Precharge', color: SIGNAL.uc,
    what: 'A bank below 12.5 V is brought up through a current-limited path before its switch closes.',
    why: 'Closing a switch onto an empty capacitor would draw a very large current. The limit is nominally 5 A.',
    flows: { X: [['b2', 1], ['b3', 1], ['e3', 1]], Y: [['p1', 1], ['p2', 1], ['e5', 1]] },
    note: { X: 'In Option X the bidirectional converter does the pre-charge itself.', Y: 'In Option Y a small pre-charge stage is needed, because the step-down converter is one-way.' } },
  { id: 'first_start', label: 'First Engine Start', color: SIGNAL.denied,
    what: 'The 12 V battery cranks the engine through the starter generator. This is one high-current battery pulse.',
    why: 'After a long park the bank may be empty, so the first start always uses the battery, exactly as today.',
    flows: { X: [['b1', -1], ...MOTOR, ['b2', 1]], Y: [['f1', 1], ...MOTOR, ['e5', 1]] } },
  { id: 'replenish', label: 'Generator Replenishment', color: SIGNAL.uc,
    what: 'The engine drives the generator, which refills the bank towards its reserve while also feeding the 12 V loads.',
    why: 'The bank is below its reserve. The controller refills it before treating any energy as spare.',
    flows: { X: [...GEN, ['b1', 1], ['b2', 1], ['b3', 1], ['e3', 1], ...DRIVE], Y: [...GEN, ['e2', 1], ['e3', 1], ['e4', 1], ['e5', 1], ...DRIVE] } },
  { id: 'cruise', label: 'Cruise', color: SIGNAL.converter,
    what: 'The engine drives the wheel. The generator carries the 12 V loads and the bank rests at its reserve.',
    why: 'The reserve is held and there is no boost request, so no energy needs to move in or out of the bank.',
    flows: { X: [...GEN, ['b1', 1], ['b2', 1], ...DRIVE], Y: [...GEN, ['e2', 1], ['e3', 1], ['e4', 1], ['e5', 1], ...DRIVE] },
    note: { Y: 'In Option Y the loads are fed across the capacitor bus and through the step-down converter.' } },
  { id: 'eco_boost', label: 'Eco Boost', color: SIGNAL.full,
    what: 'Ultracapacitor → ISG controller → electric motor assist → crankshaft. The electric machine briefly adds torque to the engine: 3 s, then a 1 s fade.',
    why: 'The rider opened the throttle, the engine is warm, and the bank holds at least the energy for this boost.',
    flows: { X: [['e3', -1], ['b3', -1], ['b2', -1], ['b1', -1], ...MOTOR, ...DRIVE], Y: [['e2', -1], ...MOTOR, ...DRIVE, ['e3', 1], ['e4', 1], ['e5', 1]] } },
  { id: 'power_boost', label: 'Power Boost', color: SIGNAL.fallback,
    what: 'The same path as Eco, held for up to 8 s. It uses up to 0.96 Wh, more than twice an Eco boost.',
    why: 'Power mode is selected. The controller holds a one-boost reserve, so a second long boost may have to wait for the generator.',
    flows: { X: [['e3', -1], ['b3', -1], ['b2', -1], ['b1', -1], ...MOTOR, ...DRIVE], Y: [['e2', -1], ...MOTOR, ...DRIVE, ['e3', 1], ['e4', 1], ['e5', 1]] } },
  { id: 'regen', label: 'Deceleration / Regeneration', color: SIGNAL.regen,
    what: 'Rear wheel → transmission → engine and crankshaft → ISG → ultracapacitor. The generator turns some braking energy into charge.',
    why: 'Fuel is cut, the clutch is engaged, and the rider needs more braking than engine braking gives. Without all three there is no free energy to recover.',
    flows: { X: [...OVERRUN, ...GEN, ['b1', 1], ['b2', 1], ['b3', 1], ['e3', 1]], Y: [...OVERRUN, ...GEN, ['e2', 1], ['e3', 1], ['e4', 1], ['e5', 1]] },
    note: { X: 'Generator power above the 160 W rating is not confirmed.', Y: 'Generator power above the 160 W rating is not confirmed.' } },
  { id: 'engine_stop', label: 'Engine Stop', color: SIGNAL.inactive,
    what: 'The bike is standing and the engine is off. The bank feeds the 12 V loads from energy above its reserve.',
    why: 'Stop-start is allowed because the bank holds enough to restart the engine. Recovered energy is used first.',
    flows: { X: [['e3', -1], ['b3', -1]], Y: [['e3', 1], ['e4', 1], ['e5', 1]] } },
  { id: 'handover', label: 'Battery Handover', color: SIGNAL.lead,
    what: 'The bank has reached its reserve, so the existing 12 V battery now carries the essential low-current loads, at about 3 A.',
    why: 'The controller preserves the capacitor reserve for the restart and the next acceleration.',
    flows: { X: [['b2', 1]], Y: [['e5', 1]] } },
  { id: 'restart', label: 'Engine Restart', color: SIGNAL.full,
    what: 'The bank restarts the engine through the starter generator. The 12 V battery is not pulsed.',
    why: 'The rider moves off. The restart energy was part of the reserve the controller kept.',
    flows: { X: [['e3', -1], ['b3', -1], ['b2', -1], ['b1', -1], ...MOTOR], Y: [['e2', -1], ...MOTOR, ['e5', 1]] } },
  { id: 'fault', label: 'Fault Fallback', color: SIGNAL.fallback,
    what: 'The ultracapacitor is disconnected and the original electrical architecture is restored where possible: the bike behaves as a stock iGO Assist.',
    why: 'A cell, converter, sensor or over-temperature fault was detected. Safe, fast switching here is a design intent and still needs hardware validation.',
    flows: { X: [...GEN, ['b1', 1], ['b2', 1], ...DRIVE], Y: [...GEN, ['f1', -1], ['e5', 1], ...DRIVE] },
    off: { X: ['uc', 'dcdc'], Y: ['uc', 'dcdc', 'pre'] } },
];

const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
const mid = (pts: Pt[]): Pt => { const a = pts[Math.floor((pts.length - 1) / 2)]; const b = pts[Math.floor((pts.length - 1) / 2) + 1] ?? a; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

/** Electrical and mechanical architecture with the energy flows of one operating state. */
export function Architecture({ option, stateId }: { option: Option; stateId: string }) {
  const lay = LAYOUT[option];
  const st = STATES.find((s) => s.id === stateId) ?? STATES[0];
  const flows = st.flows[option]; const off = st.off?.[option] ?? [];
  const active = useMemo(() => {
    const set = new Set<string>();
    for (const [id] of flows) {
      const e = lay.edges.find((x) => x.id === id);
      if (!e) continue;
      for (const n of lay.nodes) {
        const touches = (p: Pt) => p[0] >= n.x - 1 && p[0] <= n.x + W + 1 && p[1] >= n.y - 1 && p[1] <= n.y + H + 1;
        if (touches(e.pts[0]) || touches(e.pts[e.pts.length - 1])) set.add(n.id);
      }
    }
    return set;
  }, [flows, lay]);
  const colors = [...new Set(['#0B3A83', st.color])];
  return (
    <svg viewBox="0 0 990 372" className="w-full" role="img" aria-label={`CapAssist Option ${option} architecture in the ${st.label} state`}>
      <defs>
        {colors.map((c) => (
          <marker key={c} id={`arr-${c.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L10 5L0 10z" fill={c} />
          </marker>))}
      </defs>
      <text x="20" y="14" fontSize="10.5" fill="var(--muted)" letterSpacing="0.08em">MECHANICAL</text>
      <text x="220" y="150" fontSize="10.5" fill="var(--muted)" letterSpacing="0.08em">ELECTRICAL</text>
      {lay.edges.map((e) => {
        const m = e.at ?? ([mid(e.pts)[0], mid(e.pts)[1] - 7] as Pt);
        return (
          <g key={e.id}>
            <path d={pathOf(e.pts)} fill="none" stroke="var(--line)" strokeWidth={e.kind === 'mech' ? 5 : 3}
              strokeDasharray={e.kind === 'ctrl' ? '4 4' : e.kind === 'fallback' ? '2 5' : undefined} strokeLinejoin="round" />
            {e.label && <text x={m[0]} y={m[1]} textAnchor={e.anchor ?? 'middle'} fontSize="9.5" fill="var(--muted)">{e.label}</text>}
          </g>
        );
      })}
      {flows.map(([id, dir], k) => {
        const e = lay.edges.find((x) => x.id === id);
        if (!e) return null;
        const pts = dir === 1 ? e.pts : [...e.pts].reverse();
        const c = e.kind === 'mech' ? '#0B3A83' : st.color;
        return <path key={`${id}-${k}`} d={pathOf(pts)} fill="none" stroke={c} strokeWidth={e.kind === 'mech' ? 4.5 : 3.5} className="flow"
          strokeLinejoin="round" markerEnd={`url(#arr-${c.slice(1)})`} />;
      })}
      {lay.nodes.map((n) => {
        const isOff = off.includes(n.id); const on = active.has(n.id) && !isOff;
        return (
          <g key={n.id} opacity={isOff ? 0.35 : flows.length && !on ? 0.55 : 1}>
            <rect x={n.x} y={n.y} width={W} height={H} rx="9" fill={n.added ? 'rgba(8,145,178,0.10)' : 'var(--panel)'}
              stroke={on ? st.color : n.added ? SIGNAL.uc : 'var(--muted)'} strokeWidth={on ? 2.6 : 1.2} />
            <text x={n.x + W / 2} y={n.y + (n.sub ? 25 : 34)} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--head)" fontFamily="Rajdhani, Inter, sans-serif">{n.title}</text>
            {n.sub && <text x={n.x + W / 2} y={n.y + 42} textAnchor="middle" fontSize="10" fill="var(--muted)">{n.sub}</text>}
            {isOff && <path d={`M${n.x + 10} ${n.y + 10}L${n.x + W - 10} ${n.y + H - 10}M${n.x + W - 10} ${n.y + 10}L${n.x + 10} ${n.y + H - 10}`} stroke={SIGNAL.denied} strokeWidth="2" />}
          </g>
        );
      })}
      <g fontSize="10" fill="var(--muted)">
        <rect x="770" y="262" width="14" height="10" rx="2" fill="rgba(8,145,178,0.10)" stroke={SIGNAL.uc} /><text x="792" y="271">added or changed by CapAssist</text>
        <path d="M770 286H784" stroke="#0B3A83" strokeWidth="4.5" /><text x="792" y="289">mechanical power</text>
        <path d="M770 304H784" stroke={st.color} strokeWidth="3.5" /><text x="792" y="307">electrical power in this state</text>
        <path d="M770 322H784" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 4" /><text x="792" y="325">control</text>
        <path d="M770 340H784" stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 5" /><text x="792" y="343">protection and fallback path</text>
      </g>
    </svg>
  );
}
