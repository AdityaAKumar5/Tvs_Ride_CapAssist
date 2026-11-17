// Required columns for each data file. Extra columns are allowed; missing ones are reported.
export const FILES = {
  warmSeries: 'dashboard_timeseries.csv',
  warmEvents: 'boost_events.csv',
  warmMeta: 'scenario_metadata.json',
  warmResults: 'results.csv',
  coldSeries: 'cold_replay_timeseries.csv',
  coldEvents: 'cold_boost_events.csv',
  coldMeta: 'cold_scenario_metadata.json',
  coldResults: 'results_cold.csv',
  sensitivity: 'warm_sensitivity.csv',
} as const;

export const SCHEMAS: Record<string, string[]> = {
  'dashboard_timeseries.csv': ['case_id', 'case_name', 'time_s', 'speed_kmh', 'uc_voltage_v', 'assist_electrical_w',
    'generator_electrical_w', 'fuel_ml_s', 'engine_on', 'boost_request', 'boost_outcome'],
  'boost_events.csv': ['case_id', 'time_s', 'event_outcome', 'boost_energy_wh'],
  'results.csv': ['id', 'case', 'fuel_ml', 'km_per_l', 'boost_requests', 'boosts_full', 'boosts_cut_short', 'boosts_denied',
    'boost_wh', 'free_regen_wh', 'battery_out_wh', 'battery_pulses', 'engine_off_s', 'uc_vmin', 'uc_vmax'],
  'cold_replay_timeseries.csv': ['case_key', 'case_label', 'case_id', 'parked_hours', 'phase', 'time_s',
    'elapsed_from_engine_start_s', 'speed_kmh', 'ultracap_voltage_v', 'assist_electrical_w', 'generator_total_electrical_w',
    'fuel_ml_per_s', 'engine_on', 'engine_temperature_c', 'engine_warm_gate', 'bank_reserve_energy_met',
    'boost_request_outcome_label'],
  'cold_boost_events.csv': ['case_key', 'phase', 'time_s', 'elapsed_from_engine_start_s', 'event_outcome', 'boost_energy_wh'],
  'results_cold.csv': ['case', 'id', 'parked_h', 'bank_v_at_key_on', 'bank_switch_closes_s', 'bank_at_reserve_s', 'engine_warm_s',
    'cold_boost_requests', 'cold_refused_engine_cold', 'cold_boosts_full', 'cold_boosts_cut_short', 'cold_boosts_denied',
    'cold_engine_off_s', 'cold_battery_out_wh', 'cold_battery_pulses', 'precharge_from_battery_wh', 'cold_fuel_ml',
    'hot_fuel_ml', 'weighted_km_per_l'],
  'warm_sensitivity.csv': ['variation_key', 'variation_label', 'case_id', 'boost_requests', 'boosts_full'],
};

export const ALL_FILES: string[] = Object.values(FILES);
