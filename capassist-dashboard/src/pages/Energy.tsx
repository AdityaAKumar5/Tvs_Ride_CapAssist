import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { Architecture, STATES, type Option } from '../visualizations/Architecture';
import { UcLab } from '../visualizations/UcLab';
import { Card, Notice, PageHead, Segmented, StatusBadge } from '../components/ui';

export default function Energy() {
  const data = useApp((s) => s.data)!;
  const [option, setOption] = useState<Option>('Y');
  const [state, setState] = useState('eco_boost');
  const st = STATES.find((s) => s.id === state)!;
  return (
    <div className="space-y-4">
      <PageHead title="Energy Management Digital Twin" subtitle="Where the energy goes in each operating state, and why the controller chose that state"
        right={<Segmented value={option} onChange={setOption} options={[
          { value: 'Y', label: 'Option Y · re-rated controller + capacitor DC bus', title: 'The proposed production-oriented concept' },
          { value: 'X', label: 'Option X · existing controller + bidirectional converter', title: 'The lower-risk prototype architecture' }]} />} />

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-2" title="Operating state" pad={false}>
          <div className="p-2 space-y-1">
            {STATES.map((s, k) => (
              <button key={s.id} onClick={() => setState(s.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 text-[12.5px] border flex items-center gap-2 ${state === s.id ? 'text-white border-transparent' : 'border-line hover:bg-soft'}`}
                style={state === s.id ? { background: s.color } : undefined}>
                <span className="num text-[10px] opacity-70 w-4">{k + 1}</span>{s.label}
              </button>))}
          </div>
        </Card>
        <Card className="col-span-12 xl:col-span-10" title={<>Option {option} · {st.label}</>} right={<StatusBadge status="spec" />}>
          <Architecture option={option} stateId={state} />
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            <div className="rounded-lg border border-line p-3"><div className="text-[11px] uppercase tracking-wide text-muted mb-0.5">What happens</div><p className="text-[13px]">{st.what}</p>
              {st.note?.[option] && <p className="text-xs text-muted mt-1">{st.note[option]}</p>}</div>
            <div className="rounded-lg border border-line p-3" style={{ borderLeft: `4px solid ${st.color}` }}><div className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Why the controller selected this state</div><p className="text-[13px]">{st.why}</p></div>
          </div>
          <div className="mt-3">
            {option === 'Y'
              ? <Notice><b>Option Y</b> puts the bank directly on the controller's DC side, which then runs between 12.5 V and 25 V. A standard 12 V controller cannot be connected to a 25 V bank: its switches, bus capacitors and gate supply must be re-rated first. That redesign is not costed or tested.</Notice>
              : <Notice><b>Option X</b> leaves the stock 12 V controller untouched and puts a bidirectional converter of about 450 W between the 12 V bus and the bank. It suits a first prototype. The converter adds cost and a loss on every boost.</Notice>}
          </div>
          <p className="text-[11px] text-muted mt-2">Conceptual diagram of intended energy paths. Arrows show direction only; they are not driven by logged power and do not show magnitude.</p>
        </Card>
      </div>

      <UcLab data={data} />
    </div>
  );
}
