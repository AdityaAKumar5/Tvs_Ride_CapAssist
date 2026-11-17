import { motion } from 'framer-motion';
import { CheckCircle2, CircleDashed, Flame, Zap } from 'lucide-react';
import type { ActiveScenario } from '../types';
import { useReplaySecond } from '../hooks/useReplay';
import { indexAt } from '../utils/stateInfer';
import { SIGNAL } from '../styles/theme';
import { InfoTip } from '../components/ui';

function Bar({ f, color, marks }: { f: number; color: string; marks?: { f: number; label: string }[] }) {
  return (
    <div className="relative h-4 rounded-full bg-soft border border-line overflow-visible mt-6 mb-1">
      <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: color }} animate={{ width: `${Math.min(100, Math.max(0, f * 100))}%` }} transition={{ duration: 0.25 }} />
      {marks?.map((m) => (
        <div key={m.label} className="absolute -top-5 text-[10px] text-muted whitespace-nowrap" style={{ left: `${m.f * 100}%`, transform: 'translateX(-50%)' }}>
          {m.label}<span className="block mx-auto w-px h-7 bg-ink/50" />
        </div>
      ))}
    </div>
  );
}

/**
 * Boost needs two things at once: a warm engine and a bank that holds its reserve.
 * Both bars follow the replay cursor and read the modelled signals for that second.
 */
export function Readiness({ sc }: { sc: ActiveScenario }) {
  const sec = useReplaySecond();
  const i = indexAt(sc, sec); const s = sc.series; const c = sc.cold;
  const temp = s.temp[i]; const amb = c?.ambient_c ?? 30; const gateC = c?.gate_c ?? 55;
  const engineReady = s.gate[i] === 1;
  const v = s.ucV[i]; const reserveV = sc.meta.reserve_v ?? null; const vMin = sc.meta.bank?.v_min ?? 12.5;
  const bankReady = s.reserveMet[i] === 1;
  const connected = s.bankOn[i] === 1;
  const hasBank = sc.hasBank;
  const eligible = engineReady && (hasBank ? bankReady : true);
  const bankState = !hasBank ? 'No bank fitted' : bankReady ? 'Reserve held' : connected ? 'Generator replenishment' : 'Pre-charge (bank isolated)';
  const scale = (reserveV ?? 20) * 1.05;
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 lg:col-span-5 rounded-xl border border-line p-4 bg-panel">
        <div className="flex items-center justify-between">
          <h4 className="h-tech uppercase flex items-center gap-2"><Flame size={16} style={{ color: SIGNAL.temp }} />Engine readiness <InfoTip term="gate" /></h4>
          <Ready ok={engineReady} yes="Engine ready" no="Engine not ready" />
        </div>
        <Bar f={temp === null ? 0 : (temp - amb) / (gateC - amb) / 1.6} color={engineReady ? SIGNAL.full : SIGNAL.cold} marks={[{ f: 1 / 1.6, label: `gate ${gateC} °C` }]} />
        <div className="flex justify-between text-xs text-muted num"><span>ambient {amb} °C</span><span>modelled warm-up</span></div>
        <div className="mt-2 flex items-baseline gap-2"><span className="h-tech num text-4xl">{temp === null ? 'N/A' : temp.toFixed(0)}</span><span className="text-muted">°C engine temperature (modelled)</span></div>
      </div>
      <div className="col-span-12 lg:col-span-5 rounded-xl border border-line p-4 bg-panel">
        <div className="flex items-center justify-between">
          <h4 className="h-tech uppercase flex items-center gap-2"><Zap size={16} style={{ color: SIGNAL.uc }} />Ultracapacitor readiness <InfoTip term="reserve" /></h4>
          {hasBank ? <Ready ok={bankReady} yes="Bank ready" no="Bank not ready" /> : <span className="text-xs text-muted">not applicable</span>}
        </div>
        {hasBank && reserveV ? (<>
          <Bar f={(v ?? 0) / scale} color={bankReady ? SIGNAL.full : SIGNAL.uc} marks={[{ f: vMin / scale, label: `connect ${vMin} V` }, { f: reserveV / scale, label: `reserve ${reserveV.toFixed(1)} V` }]} />
          <div className="flex justify-between text-xs text-muted num"><span>at key-on {c?.uc_voltage_at_key_on_v?.toFixed(1) ?? 'N/A'} V</span><span>{bankState}</span></div>
          <div className="mt-2 flex items-baseline gap-2"><span className="h-tech num text-4xl">{v === null ? 'N/A' : v.toFixed(1)}</span><span className="text-muted">V bank voltage (modelled)</span></div>
        </>) : <p className="text-[13px] text-muted mt-4">This system has no ultracapacitor bank. Its boost depends on engine temperature and on the 12 V battery recovering between boosts.</p>}
      </div>
      <div className={`col-span-12 lg:col-span-2 rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center transition-colors ${eligible ? 'border-ok bg-ok/10' : 'border-line bg-soft'}`}>
        <motion.div animate={{ scale: eligible ? [1, 1.12, 1] : 1 }} transition={{ duration: 1.2, repeat: eligible ? Infinity : 0 }}>
          <Zap size={34} style={{ color: eligible ? SIGNAL.full : SIGNAL.inactive }} fill={eligible ? SIGNAL.full : 'none'} />
        </motion.div>
        <div className="h-tech text-lg mt-1" style={{ color: eligible ? SIGNAL.full : 'var(--muted)' }}>{eligible ? 'BOOST ELIGIBLE' : 'NOT YET ELIGIBLE'}</div>
        <p className="text-[10px] text-muted mt-1 leading-tight">Control eligibility in the model at {sec} s. Not a guarantee that thermal, electrical and other real-world limits are met.</p>
      </div>
    </div>
  );
}

function Ready({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`flex items-center gap-1 text-xs font-semibold ${ok ? 'text-ok' : 'text-muted'}`}>{ok ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}{ok ? yes : no}</span>;
}
