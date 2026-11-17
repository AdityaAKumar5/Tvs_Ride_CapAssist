import type { ActiveScenario, BoostEvent } from '../types';
import { SIGNAL } from '../styles/theme';

export interface OperatingState { id: string; label: string; color: string; explain: string; }

/** Index into the series for a time on the replay axis. */
export function indexAt(sc: ActiveScenario, t: number): number {
  const i = Math.round(t) - sc.series.t[0];
  return Math.min(sc.series.n - 1, Math.max(0, i));
}

/**
 * Operating state for the replay. These labels are INFERRED from the logged signals
 * (speed, assist power, engine flag, bank voltage, boost events); the model does not log a state name.
 */
export function inferState(sc: ActiveScenario, t: number): OperatingState {
  const s = sc.series; const i = indexAt(sc, t);
  const v = s.speed[i]; const vPrev = s.speed[Math.max(0, i - 1)]; const vNext = s.speed[Math.min(s.n - 1, i + 1)];
  const accel = (vNext - vPrev) / 2 / 3.6; // m/s2, centred difference
  const recent = (o: BoostEvent['outcome']) => sc.events.find((e) => e.outcome === o && t >= e.t && t <= e.t + 3);
  if (recent('engine_cold')) return { id: 'cold', label: 'Cold Restriction', color: SIGNAL.cold,
    explain: 'The rider asked for assist, but the engine is below the temperature gate. The stock system applies the same rule.' };
  if (recent('denied')) return { id: 'denied', label: 'Boost Denied', color: SIGNAL.denied,
    explain: 'The rider asked for assist, but the energy store could not supply it at that moment.' };
  if (s.assistW[i] > 0) return { id: 'assist', label: 'Electric Assist', color: SIGNAL.full,
    explain: `The starter generator is working as a motor and adding torque at the crankshaft (${Math.round(s.assistW[i])} W electrical).` };
  if (s.engineOn[i] === 0) return { id: 'off', label: 'Engine Off', color: SIGNAL.inactive,
    explain: 'The bike is standing and stop-start has switched the engine off. No fuel is burned.' };
  if (v < 0.5) return { id: 'idle', label: 'Idle', color: SIGNAL.lead, explain: 'The bike is standing with the engine running.' };
  if (accel > 0.3) return { id: 'accel', label: 'Acceleration', color: SIGNAL.speed, explain: 'The engine is accelerating the bike without electric assist.' };
  if (accel < -0.3) return { id: 'decel', label: 'Deceleration', color: SIGNAL.regen,
    explain: 'The bike is slowing. Any generator output above the 12 V load during a fuel cut is recovered energy; the log shows total generator output only.' };
  const u = s.ucV[i]; const uPrev = s.ucV[Math.max(0, i - 2)];
  if (u !== null && uPrev !== null && u - uPrev > 0.05) return { id: 'refill', label: 'Replenishment', color: SIGNAL.uc,
    explain: 'The generator is refilling the ultracapacitor bank towards its reserve.' };
  return { id: 'cruise', label: 'Cruise', color: SIGNAL.converter, explain: 'Steady riding. The generator carries the 12 V loads.' };
}

/** Events whose outcome is already known at time t (the outcome is only known when the boost ends). */
export function revealed(e: BoostEvent, t: number): boolean { return t >= e.end; }
