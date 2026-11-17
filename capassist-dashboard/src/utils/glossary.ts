import type { DataStatus } from '../types';

export const GLOSSARY: Record<string, { title: string; text: string }> = {
  availability: { title: 'Boost availability', text: 'Full boosts divided by boost requests, as a percentage. A boost is full when the store supplied it for as long as the selected profile and the acceleration lasted. With no requests the figure is not applicable.' },
  usable: { title: 'Ultracapacitor usable energy', text: 'The energy between the maximum bank voltage and the 12.5 V lower limit: E = 0.5 x C x (Vmax^2 - Vmin^2). Below 12.5 V the controller cannot use the bank.' },
  regen: { title: 'Regeneration', text: 'Electricity generated while the engine fuel is cut and the rider needs more braking than engine braking gives. The time series logs total generator output only; the regeneration figure is a per-scenario total.' },
  pulse: { title: 'Battery pulse duty', text: 'Each boost or engine restart the 12 V battery has to supply, at up to about 35 A in the model. A count of events, not a measured current.' },
  acceptance: { title: 'Battery acceptance', text: 'The charging power the lead-acid battery will take back after a boost. It is not known for the stock bike, so three values are simulated: 34 W, 68 W and 120 W.' },
  reserve: { title: 'Reserve voltage', text: 'The bank voltage that holds the selected boost reserve plus one restart: about 19.3 V for two Eco boosts, about 20.0 V for one Power boost. The controller treats only energy above it as spare.' },
  precharge: { title: 'Pre-charge', text: 'Bringing a discharged bank up to bus voltage through a current-limited stage before its switch closes. Nominal limit 5 A. The circuit is a concept and has not been built.' },
  gate: { title: 'Engine temperature gate', text: 'Boost and stop-start are refused below about 55 C engine temperature, as on the stock bike. Engine temperature here is modelled, not measured.' },
  generator: { title: 'Generator electrical output', text: 'Total electrical power from the starter generator: 12 V loads, bank refill and recovered energy together. It is not regeneration alone.' },
  handover: { title: 'Battery handover', text: 'With the engine off, the bank feeds the 12 V loads only from energy above its reserve. After that the 12 V battery carries them at about 3 A.' },
};

export const STATUS_LABEL: Record<DataStatus, { short: string; long: string; cls: string }> = {
  sim: { short: 'SIM', long: 'Simulation output', cls: 'bg-electric/10 text-electric border-electric/30' },
  calc: { short: 'CALC', long: 'Calculated estimate', cls: 'bg-uc/10 text-uc border-uc/30' },
  spec: { short: 'SPEC', long: 'Documented vehicle specification', cls: 'bg-ok/10 text-ok border-ok/30' },
  assumed: { short: 'ASSUMED', long: 'Unverified assumption', cls: 'bg-regen/10 text-regen border-regen/40' },
};
