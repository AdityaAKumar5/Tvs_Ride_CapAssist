import { motion } from 'framer-motion';
import { BatteryCharging, CheckCircle2, KeyRound, ParkingCircle, Power, Zap } from 'lucide-react';
import type { ActiveScenario } from '../types';
import { useReplaySecond } from '../hooks/useReplay';
import { indexAt } from '../utils/stateInfer';
import { fmt } from '../utils/calc';
import { parkLabel } from '../utils/scenario';
import { SIGNAL } from '../styles/theme';

/**
 * Parking -> Key On -> Pre-charge -> Engine Start -> Generator Refill -> Ready.
 * The first stages happen before the timestamped replay begins, so they are shown from the scenario
 * metadata as a modelled process. Only the last three follow the replay cursor.
 */
export function KeyOnSequence({ sc, wide }: { sc: ActiveScenario; wide?: boolean }) {
  const sec = useReplaySecond();
  const c = sc.cold;
  if (!c || !sc.hasBank) return <p className="text-[13px] text-muted">The key-on pre-charge sequence applies to scenarios with an ultracapacitor bank.</p>;
  const i = indexAt(sc, sec); const s = sc.series;
  const needsPre = (c.uc_voltage_at_key_on_v ?? 99) < (sc.meta.bank?.v_min ?? 12.5);
  const connected = s.bankOn[i] === 1; const ready = s.reserveMet[i] === 1;
  const active = ready ? 5 : connected ? 4 : 2; // index of the stage the replay is in
  const steps = [
    { icon: ParkingCircle, title: 'Parking', lines: [`${parkLabel(c.parked_hours)} parked`, `left at ${fmt(c.uc_voltage_at_key_off_v, 1)} V`, c.balancing_connected_while_parked ? 'balancing resistors connected' : 'balancing resistors disconnected'], pre: true },
    { icon: KeyRound, title: 'Key on', lines: [`bank at ${fmt(c.uc_voltage_at_key_on_v, 1)} V`, needsPre ? 'below 12.5 V: bank stays isolated' : 'above 12.5 V: bank connects at once'], pre: true },
    { icon: BatteryCharging, title: 'Pre-charge', lines: needsPre ? [`${c.precharge_current_a} A current limit`, `battery gives ${fmt(c.precharge_from_battery_before_start_wh, 3)} Wh before start`, `bank switch closes at ${c.bank_switch_closes_s ?? 'N/A'} s`] : ['not needed'], pre: false },
    { icon: Power, title: 'Engine start', lines: [`${c.key_on_to_engine_start_s} s after key-on`, `12 V battery cranks: ${fmt(c.first_start_pulse_wh, 3)} Wh`, 'replay time 0 starts here'], pre: true },
    { icon: Zap, title: 'Generator refill', lines: [`towards ${fmt(sc.meta.reserve_v ?? null, 1)} V reserve`, 'generator supplies the pre-charge too'], pre: false },
    { icon: CheckCircle2, title: 'Ready', lines: [`reserve held at ${c.bank_at_reserve_s ?? 'N/A'} s`, `engine warm at ${c.engine_warm_s ?? 'N/A'} s`], pre: false },
  ];
  const state = (k: number): 'done' | 'active' | 'todo' => {
    if (steps[k].pre) return 'done';
    if (k === 2) return !needsPre || connected ? 'done' : 'active';
    if (k === 4) return ready ? 'done' : connected ? 'active' : 'todo';
    return ready ? 'active' : 'todo';
  };
  void active;
  return (
    <div>
      <div className={`grid grid-cols-2 md:grid-cols-3 ${wide ? 'xl:grid-cols-6' : ''} gap-2`}>
        {steps.map((st, k) => {
          const stt = state(k); const Icon = st.icon;
          const col = stt === 'active' ? SIGNAL.uc : stt === 'done' ? SIGNAL.full : SIGNAL.inactive;
          return (
            <motion.div key={st.title} animate={{ opacity: stt === 'todo' ? 0.5 : 1, y: stt === 'active' ? -2 : 0 }}
              className="relative rounded-lg border p-2.5 bg-panel" style={{ borderColor: stt === 'active' ? col : 'var(--line)', boxShadow: stt === 'active' ? `0 0 0 2px ${col}33` : 'none' }}>
              <div className="flex items-center gap-1.5"><Icon size={16} style={{ color: col }} /><b className="h-tech uppercase text-[13px]">{k + 1} · {st.title}</b></div>
              <ul className="mt-1 text-[11.5px] text-muted leading-snug">{st.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              {st.pre && <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wide text-muted border border-line rounded px-1">before the replay starts</span>}
            </motion.div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-2">Modelled process. The {c.key_on_to_engine_start_s} s between key-on and engine start are not in the time series, so no current or voltage waveform is drawn for them; their totals come from the scenario metadata. A real circuit needs voltage sensing, current regulation, a controlled bank connection and suitable voltage conversion. None of that has been built or tested.</p>
    </div>
  );
}
