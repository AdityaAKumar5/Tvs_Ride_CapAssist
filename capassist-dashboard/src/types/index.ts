// Typed interfaces for the warm and cold data packages.

export type Condition = 'warm' | 'cold' | 'hot';
export type Outcome = 'full' | 'cut_short' | 'denied' | 'engine_cold';
export type Family = 'conventional' | 'stock' | 'capassist' | 'lithium';
export type DataStatus = 'sim' | 'calc' | 'spec' | 'assumed';

/** One scenario's summary numbers for one pass. Null = not applicable or not in the data. */
export interface Summary {
  fuelMl: number | null;
  kmPerL: number | null;
  requests: number;
  full: number;
  cutShort: number;
  denied: number;
  engineCold: number;
  boostWh: number | null;
  regenWh: number | null;
  batteryOutWh: number | null;
  batteryPulses: number | null;
  engineOffS: number | null;
  ucVmin: number | null;
  ucVmax: number | null;
}

export interface BankInfo {
  capacitance_f: number; esr_ohm: number; v_max: number; v_min: number; cells: number; usable_wh: number;
}

/** Fields shared by warm and cold scenario metadata. */
export interface ScenarioMeta {
  case_id: string;
  case_name: string;
  short_name: string;
  family: Family;
  architecture: 'X' | 'Y' | null;
  mode: 'Eco' | 'Power' | 'Stock' | null;
  boost_profile: 'sustained_8s' | 'tapered_3s_1s' | null;
  boost_profile_max_wh: number | null;
  generator_w: number;
  stop_start: boolean;
  store_type: 'uc' | 'pb' | 'li' | null;
  reserve_boosts?: number;
  reserve_j?: number;
  reserve_v?: number;
  bank?: BankInfo;
  battery_accept_w?: number;
  verification_status: string;
}

export interface WarmScenario extends ScenarioMeta { summary: Summary; }

export interface ColdScenario extends ScenarioMeta {
  case_key: string;
  case_label: string;
  group: 'baseline' | 'parking' | 'sensitivity';
  parked_hours: number;
  balancing_connected_while_parked: boolean;
  source_scenario: string;
  parameter_overrides: Record<string, number>;
  uc_voltage_at_key_off_v: number | null;
  uc_voltage_at_key_on_v: number | null;
  bank_switch_closes_s: number | null;
  bank_at_reserve_s: number | null;
  engine_warm_s: number | null;
  precharge_from_battery_before_start_wh: number;
  precharge_into_bank_wh: number;
  first_start_pulse_wh: number;
  key_on_to_engine_start_s: number;
  precharge_current_a: number;
  ambient_c: number;
  gate_c: number;
  weighted_km_per_l: number;
  cold: Summary & { batteryDeficitEndWh: number | null };
  hot: Summary & { batteryDeficitEndWh: number | null };
}

/** Time series as a struct of arrays, one entry per second. */
export interface Series {
  n: number;
  t: number[];                 // seconds on the replay axis (1..600 warm, 1..1200 cold+hot)
  speed: number[];             // km/h
  ucV: (number | null)[];      // V, null when no bank is fitted
  assistW: number[];           // W electrical into the ISG as a motor
  genW: number[];              // W total generator electrical output (not regeneration only)
  fuel: number[];              // mL/s
  engineOn: number[];          // 1 or 0
  battW: number[];             // W supplied by the 12 V battery
  soc: (number | null)[];      // % lead-acid state of charge (stock cases only)
  temp: (number | null)[];     // C modelled engine temperature (cold package only)
  gate: (number | null)[];     // 1 when the engine is above the boost gate (cold package only)
  reserveMet: (number | null)[]; // 1 when the bank is connected and holds its reserve
  bankOn: (number | null)[];   // 1 when the bank switch is closed
}

export interface BoostEvent {
  t: number;        // request time on the replay axis
  end: number;      // when the outcome is known
  outcome: Outcome;
  wh: number;
  phase: 'warm' | 'cold' | 'hot';
}

export interface SensitivityRow {
  variation_key: string; variation_label: string; case_id: string;
  fuel_ml: number | null; km_per_l: number | null; boost_requests: number; boosts_full: number;
  boosts_cut_short: number; boosts_denied: number; free_regen_wh: number | null;
  battery_out_wh: number | null; battery_pulses: number | null; uc_vmin: number | null; uc_vmax: number | null;
}

export interface ColdResultRow {
  case: string; id: string; parked_h: number | null; bank_v_at_key_on: number | null;
  bank_switch_closes_s: number | null; bank_at_reserve_s: number | null; engine_warm_s: number | null;
  cold_boost_requests: number; cold_refused_engine_cold: number; cold_boosts_full: number;
  cold_boosts_cut_short: number; cold_boosts_denied: number; cold_engine_off_s: number | null;
  cold_battery_out_wh: number | null; cold_battery_pulses: number | null; precharge_from_battery_wh: number | null;
  cold_fuel_ml: number | null; hot_fuel_ml: number | null; weighted_km_per_l: number | null;
}

export interface DataBundle {
  warm: {
    order: string[];
    scenarios: Record<string, WarmScenario>;
    series: Record<string, Series>;
    events: Record<string, BoostEvent[]>;
    info: { model: string; cycle: string; duration: number; distanceM: number };
  };
  cold: {
    order: string[];
    scenarios: Record<string, ColdScenario>;
    series: Record<string, Series>;      // 1200 samples: cold pass then hot pass
    events: Record<string, BoostEvent[]>;
    results: ColdResultRow[];
    assumptions: Record<string, unknown>;
    weighting: string;
  };
  sensitivity: SensitivityRow[];
  counts: { warmScenarios: number; coldScenarios: number; warmSamples: number; coldSamples: number };
}

/** The scenario currently on screen, whatever package it came from. */
export interface ActiveScenario {
  key: string;
  label: string;
  shortLabel: string;
  condition: Condition;
  conditionLabel: string;
  meta: ScenarioMeta;
  cold?: ColdScenario;
  series: Series;
  events: BoostEvent[];
  summary: Summary;
  range: [number, number];
  hasBank: boolean;
}

export type RawFiles = Record<string, string>;
