"""Export the CapAssist model results for the dashboard.

Usage:  python3 export_dashboard_data.py <output_folder>
Writes the warm package (12 scenarios x 600 s) and the cold package (17 scenarios x 1200 s)
straight from sim.py, so the dashboard never holds a number the model did not produce.
"""
import csv, json, math, os, sys
import sim

OUT = sys.argv[1] if len(sys.argv) > 1 else "dashboard_data"
os.makedirs(OUT, exist_ok=True)
cyc = sim.load_cycle()
CASES = sim.cases()
CS = {cid: c for cid, _, c in CASES}
NAMES = {cid: n for cid, n, _ in CASES}
P0 = sim.base_params()

SHORT = {"A": "Conventional", "B1": "Stock iGO, 34 W", "B2": "Stock iGO, 68 W", "B3": "Stock iGO, 120 W",
         "C": "CapAssist X Eco", "D0": "CapAssist Y Eco, 1-boost reserve", "D": "CapAssist Y Eco", "DP": "CapAssist Y Power",
         "DA": "CapAssist aged/hot", "E": "CapAssist 430 W gen", "D8": "CapAssist 8-cell", "F": "Li 12 V, Eco"}
LONG = {"A": "Conventional vehicle", "B1": "Stock iGO Assist, 34 W battery acceptance", "B2": "Stock iGO Assist, 68 W battery acceptance",
        "B3": "Stock iGO Assist, 120 W battery acceptance", "C": "CapAssist Option X Eco",
        "D0": "CapAssist Option Y Eco, one-boost reserve (superseded)", "D": "CapAssist Option Y Eco", "DP": "CapAssist Option Y Power",
        "DA": "CapAssist Y Eco, aged and hot bank", "E": "CapAssist Y Eco, 430 W generator stretch case",
        "D8": "CapAssist Y Eco, 8-cell bank", "F": "High-power lithium 12 V alternative, Eco"}


def family(cid):
    if cid == "A": return "conventional"
    if cid.startswith("B"): return "stock"
    if cid == "F": return "lithium"
    return "capassist"


def describe(cid):
    c = CS[cid]; s = c.get("store") or {}
    prof = c.get("profile")
    d = dict(case_id=cid, case_name=LONG[cid], short_name=SHORT[cid], model_name=NAMES[cid], family=family(cid),
             architecture=("X" if cid == "C" else ("Y" if family(cid) == "capassist" else None)),
             mode=("Power" if cid == "DP" else ("Eco" if family(cid) in ("capassist", "lithium") else ("Stock" if family(cid) == "stock" else None))),
             boost_profile=({"full8": "sustained_8s", "taper": "tapered_3s_1s"}.get(prof)),
             boost_profile_max_wh=(round(sim.BOOST_J[prof] / 3600, 3) if prof else None),
             generator_w=c.get("gen_w", 160.0), stop_start=bool(c.get("stopstart")),
             store_type=s.get("type"), verification_status="simulation output")
    if s.get("type") == "uc":
        res = sim.reserve_of(c, s, P0)
        d.update(reserve_boosts=c.get("reserve_n", 1), reserve_j=round(res, 1),
                 reserve_v=round(math.sqrt(s["vmin"] ** 2 + 2 * res / s["C"]), 2),
                 bank=dict(capacitance_f=s["C"], esr_ohm=s["esr"], v_max=s["vmax"], v_min=s["vmin"], cells=s["n_cells"],
                           usable_wh=round(0.5 * s["C"] * (s["vmax"] ** 2 - s["vmin"] ** 2) / 3600, 3)))
    if s.get("type") == "pb":
        d.update(battery_accept_w=s["accept"])
    return d


def summary(r):
    return dict(fuel_ml=round(r["fuel_ml"], 2), km_per_l=round(r["kmpl"], 2), boost_requests=r["req"], boosts_full=r["full"],
                boosts_cut_short=r["part"], boosts_denied=r["denied"], boosts_engine_cold=r["gated"], boost_wh=round(r["boost_wh"], 3),
                free_regen_wh=round(r["free_wh"], 3), battery_out_wh=round(r["batt_wh"], 3), battery_pulses=r["batt_pulses"],
                engine_off_s=r["off_s"], uc_vmin=(round(r["vmin"], 2) if r["vmin"] < 99 else None),
                uc_vmax=(round(r["vmax"], 2) if r["vmax"] > 0 else None))


def event_maps(r):
    start = {e[0]: e for e in r["events"]}
    return start


LABEL = {"full": "full", "cut short": "cut_short", "denied": "denied", "engine cold": "engine_cold"}

# ---------------------------------------------------------------- warm package
warm_meta = []
with open(os.path.join(OUT, "dashboard_timeseries.csv"), "w", newline="") as fts, \
     open(os.path.join(OUT, "boost_events.csv"), "w", newline="") as fev, \
     open(os.path.join(OUT, "results.csv"), "w", newline="") as fres:
    wts = csv.writer(fts); wev = csv.writer(fev); wres = csv.writer(fres)
    wts.writerow(["case_id", "case_name", "time_s", "speed_kmh", "uc_voltage_v", "assist_electrical_w", "generator_electrical_w",
                  "fuel_ml_s", "engine_on", "boost_request", "boost_outcome", "battery_output_w", "battery_soc_pct"])
    wev.writerow(["case_id", "time_s", "end_time_s", "event_outcome", "boost_energy_wh"])
    wres.writerow(["id", "case", "fuel_ml", "km_per_l", "boost_requests", "boosts_full", "boosts_cut_short", "boosts_denied",
                   "boost_wh", "free_regen_wh", "battery_out_wh", "battery_pulses", "engine_off_s", "uc_vmin", "uc_vmax"])
    for cid, name, c in CASES:
        r = sim.run(cyc, c)
        is_uc = c["kind"] == "cap" and c["store"]["type"] == "uc"
        ev = event_maps(r)
        for t in r["trace"]:
            e = ev.get(t[0])
            wts.writerow([cid, LONG[cid], t[0], t[1], (round(t[2], 3) if is_uc else ""), round(t[3], 1), round(t[4], 1),
                          round(t[5], 5), t[6], 1 if e else 0, LABEL[e[1]] if e else "", round(t[10], 1),
                          (round(t[11], 2) if c["kind"] == "igo" else "")])
        for e in sorted(r["events"]):
            wev.writerow([cid, e[0], e[3], LABEL[e[1]], round(e[2], 4)])
        sm = summary(r)
        wres.writerow([cid, name, sm["fuel_ml"], sm["km_per_l"], r["req"], r["full"], r["part"], r["denied"], sm["boost_wh"],
                       sm["free_regen_wh"], sm["battery_out_wh"], r["batt_pulses"], r["off_s"],
                       "" if sm["uc_vmin"] is None else sm["uc_vmin"], "" if sm["uc_vmax"] is None else sm["uc_vmax"]])
        d = describe(cid); d["summary"] = sm; d["samples"] = len(r["trace"]); d["operating_condition"] = "warm steady state"
        warm_meta.append(d)

json.dump(dict(
    package="CapAssist warm-operation replay", model="sim.py version 2", cycle="WMTC Part 1, reduced speed",
    cycle_duration_s=len(cyc), cycle_distance_m=round(sum(cyc) / 3.6, 1),
    note="Each case is run six times in a row and the last pass is reported, so the store ends the pass as it began. Engine warm.",
    signal_notes=dict(generator_electrical_w="total generator electrical output, not regeneration only",
                      boost_outcome="known only when the boost ends; end_time_s in boost_events.csv says when",
                      uc_voltage_v="blank for systems without an ultracapacitor bank",
                      battery_output_w="power the 12 V battery supplies in that second (model output)"),
    scenarios=warm_meta), open(os.path.join(OUT, "scenario_metadata.json"), "w"), indent=1)

# warm stress cases (precomputed, for the comparison page)
VARS = [("base", "Base assumptions", {}, "reduced_kmh"),
        ("load_60w", "60 W electrical load", dict(load_w=60.0), "reduced_kmh"),
        ("const_power", "Assist at constant 346 W at any engine speed", dict(assist_const_p=True), "reduced_kmh"),
        ("mass_253", "253 kg, fully laden", dict(m=253.0), "reduced_kmh"),
        ("low_drag", "Less engine drag (idle fuel 0.10 L/h)", dict(idle_lph=0.10), "reduced_kmh"),
        ("normal_speed", "WMTC Part 1, normal speed", {}, "normal_kmh")]
with open(os.path.join(OUT, "warm_sensitivity.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["variation_key", "variation_label", "case_id", "fuel_ml", "km_per_l", "boost_requests", "boosts_full",
                "boosts_cut_short", "boosts_denied", "free_regen_wh", "battery_out_wh", "battery_pulses", "uc_vmin", "uc_vmax"])
    for vk, vl, chg, col in VARS:
        p = sim.base_params(); p.update(chg); cy = sim.load_cycle(column=col)
        for cid in ("A", "B1", "B2", "B3", "C", "D", "DP", "DA", "D8", "E", "F"):
            r = sim.run(cy, CS[cid], p); sm = summary(r)
            w.writerow([vk, vl, cid, sm["fuel_ml"], sm["km_per_l"], r["req"], r["full"], r["part"], r["denied"], sm["free_regen_wh"],
                        sm["battery_out_wh"], r["batt_pulses"], "" if sm["uc_vmin"] is None else sm["uc_vmin"],
                        "" if sm["uc_vmax"] is None else sm["uc_vmax"]])

# ---------------------------------------------------------------- cold package
COLD = [
    ("A_conv", "Conventional vehicle", "A", 12, False, {}, "baseline"),
    ("B1_stock", "Stock iGO Assist, 34 W battery acceptance", "B1", 12, False, {}, "baseline"),
    ("B2_stock", "Stock iGO Assist, 68 W battery acceptance", "B2", 12, False, {}, "baseline"),
    ("B3_stock", "Stock iGO Assist, 120 W battery acceptance", "B3", 12, False, {}, "baseline"),
    ("D_park_12h", "CapAssist Y Eco, parked overnight (12 h)", "D", 12, False, {}, "parking"),
    ("D_park_60h", "CapAssist Y Eco, parked a weekend (60 h)", "D", 60, False, {}, "parking"),
    ("D_park_168h", "CapAssist Y Eco, parked one week", "D", 168, False, {}, "parking"),
    ("D_park_720h", "CapAssist Y Eco, parked one month", "D", 720, False, {}, "parking"),
    ("D_park_12h_balancing_on", "CapAssist Y Eco, 12 h, balancing resistors left connected", "D", 12, True, {}, "sensitivity"),
    ("DP_park_12h", "CapAssist Y Power, parked overnight (12 h)", "DP", 12, False, {}, "parking"),
    ("DP_park_720h", "CapAssist Y Power, parked one month", "DP", 720, False, {}, "parking"),
    ("D_720h_warm_fast", "Eco, one month: engine warms twice as fast", "D", 720, False, dict(th_cap=3000.0), "sensitivity"),
    ("D_720h_warm_slow", "Eco, one month: engine warms half as fast", "D", 720, False, dict(th_cap=12000.0), "sensitivity"),
    ("D_720h_ambient_15c", "Eco, one month: ambient 15 C", "D", 720, False, dict(t_amb=15.0), "sensitivity"),
    ("D_720h_precharge_2p5a", "Eco, one month: pre-charge limited to 2.5 A", "D", 720, False, dict(pre_a=2.5), "sensitivity"),
    ("D_720h_precharge_10a", "Eco, one month: pre-charge at 10 A", "D", 720, False, dict(pre_a=10.0), "sensitivity"),
    ("D_720h_payback_34w", "Eco, one month: battery pay-back limited to 34 W", "D", 720, False, dict(batt_accept_w=34.0), "sensitivity"),
]
cold_meta = []
with open(os.path.join(OUT, "cold_replay_timeseries.csv"), "w", newline="") as fts, \
     open(os.path.join(OUT, "cold_boost_events.csv"), "w", newline="") as fev, \
     open(os.path.join(OUT, "results_cold.csv"), "w", newline="") as fres:
    wts = csv.writer(fts); wev = csv.writer(fev); wres = csv.writer(fres)
    wts.writerow(["case_key", "case_label", "case_id", "parked_hours", "phase", "time_s", "elapsed_from_engine_start_s", "speed_kmh",
                  "ultracap_voltage_v", "assist_electrical_w", "generator_total_electrical_w", "fuel_ml_per_s", "engine_on",
                  "engine_temperature_c", "engine_warm_gate", "bank_reserve_energy_met", "boost_request_outcome_label",
                  "bank_connected", "battery_output_w", "battery_soc_pct"])
    wev.writerow(["case_key", "phase", "time_s", "elapsed_from_engine_start_s", "end_time_s", "event_outcome", "boost_energy_wh"])
    wres.writerow(["case", "id", "parked_h", "bank_v_at_key_on", "bank_switch_closes_s", "bank_at_reserve_s", "engine_warm_s",
                   "cold_boost_requests", "cold_refused_engine_cold", "cold_boosts_full", "cold_boosts_cut_short", "cold_boosts_denied",
                   "cold_engine_off_s", "cold_battery_out_wh", "cold_battery_pulses", "precharge_from_battery_wh",
                   "cold_fuel_ml", "hot_fuel_ml", "weighted_km_per_l"])
    for key, label, cid, park, bal, chg, group in COLD:
        p = sim.base_params(); p.update(chg)
        c = CS[cid]
        cold, hot, info = sim.run_cold(cyc, c, p, park, bal)
        is_uc = c["kind"] == "cap" and c["store"]["type"] == "uc"
        for phase, r, off in (("cold", cold, 0), ("hot", hot, len(cyc))):
            ev = event_maps(r)
            for t in r["trace"]:
                e = ev.get(t[0])
                wts.writerow([key, label, cid, park, phase, t[0], t[0] + off, t[1], (round(t[2], 3) if is_uc else ""), round(t[3], 1),
                              round(t[4], 1), round(t[5], 5), t[6], round(t[7], 2), int(t[7] >= p["t_gate"]), (t[9] if is_uc else ""),
                              LABEL[e[1]] if e else "", (t[8] if is_uc else ""), round(t[10], 1),
                              (round(t[11], 2) if c["kind"] == "igo" else "")])
            for e in sorted(r["events"]):
                wev.writerow([key, phase, e[0], e[0] + off, e[3] + off, LABEL[e[1]], round(e[2], 4)])
        dash = lambda x: "-" if x is None else x
        vk = "-" if info["v_key"] is None else round(info["v_key"], 1)
        wres.writerow([label, cid, park, vk, dash(cold["t_bank_on"]), dash(cold["t_ready"]), dash(cold["t_warm"]), cold["req"],
                       cold["gated"], cold["full"], cold["part"], cold["denied"], cold["off_s"], round(cold["batt_wh"], 3),
                       cold["batt_pulses"], round(info["pre_batt_wh"], 3), round(cold["fuel_ml"], 2), round(hot["fuel_ml"], 2),
                       round(info["kmpl_weighted"], 2)])
        d = describe(cid)
        d.update(case_key=key, case_label=label, group=group, parked_hours=park, balancing_connected_while_parked=bal,
                 source_scenario=cid, parameter_overrides=chg, operating_condition="cold start after parking, then hot pass",
                 uc_voltage_at_key_off_v=(round(info["v_off"], 2) if info["v_off"] else None),
                 uc_voltage_at_key_on_v=(round(info["v_key"], 2) if info["v_key"] is not None else None),
                 bank_switch_closes_s=cold["t_bank_on"], bank_at_reserve_s=cold["t_ready"], engine_warm_s=cold["t_warm"],
                 precharge_from_battery_before_start_wh=round(info["pre_batt_wh"], 4),
                 precharge_into_bank_wh=round(cold["pre_j"] / 3600, 3),
                 first_start_pulse_wh=(round(p["restart_j"] / 3600, 4) if c["kind"] in ("igo", "cap") else 0.0),
                 key_on_to_engine_start_s=p["key_lead_s"], precharge_current_a=p["pre_a"], ambient_c=p["t_amb"], gate_c=p["t_gate"],
                 weighted_km_per_l=round(info["kmpl_weighted"], 2),
                 cold=dict(summary(cold), battery_deficit_end_wh=round(cold["deficit_wh"], 3), engine_temp_end_c=round(cold["t_end"], 1)),
                 hot=dict(summary(hot), battery_deficit_end_wh=round(hot["deficit_wh"], 3), engine_temp_end_c=round(hot["t_end"], 1)),
                 samples=len(cold["trace"]) + len(hot["trace"]))
        cold_meta.append(d)

json.dump(dict(
    package="CapAssist cold-start replay", model="sim.py version 2", cycle="WMTC Part 1, reduced speed: cold pass then hot pass",
    weighting="50% cold, 50% hot (UN GTR No. 2, Class 1)", cycle_duration_s=len(cyc), cycle_distance_m=round(sum(cyc) / 3.6, 1),
    note="The five seconds between key-on and engine start are not in the time series; their totals are in each scenario's metadata.",
    assumptions=dict(ambient_c=P0["t_amb"], boost_gate_c=P0["t_gate"], fully_warm_c=P0["t_full"], cold_fuel_penalty=P0["cold_pen"],
                     thermal_mass_j_per_k=P0["th_cap"], fuel_heat_share=P0["th_frac"], cooling_w_per_k=P0["th_h0"],
                     cooling_w_per_k_per_ms=P0["th_hv"], precharge_current_a=P0["pre_a"], precharge_efficiency=P0["pre_eta"],
                     key_on_to_start_s=P0["key_lead_s"], cell_leakage_ma=P0["leak_ma"], restart_j=P0["restart_j"],
                     lead_acid_self_discharge="not modelled", status="all assumed, none measured"),
    signal_notes=dict(generator_total_electrical_w="total generator electrical output, not regeneration only",
                      engine_temperature_c="modelled, not measured", ultracap_voltage_v="modelled; blank when no bank is fitted",
                      bank_reserve_energy_met="1 when the bank is connected and holds its selected reserve"),
    scenarios=cold_meta), open(os.path.join(OUT, "cold_scenario_metadata.json"), "w"), indent=1)

# the cycle itself
with open("wmtc_part1.csv") as fi, open(os.path.join(OUT, "wmtc_part1.csv"), "w") as fo:
    fo.write(fi.read())
print("written to", OUT, ":", sorted(os.listdir(OUT)))
