"""CapAssist drive-cycle energy model, version 2 (backward-facing, 1 s steps).

Vehicle: TVS Raider 125 iGO Assist figures from the owner's manual.
Cycle:   WMTC Part 1, UN document TRANS/WP.29/GRPE/2004/10 Annex B (wmtc_part1.csv).
Values marked ASSUMED are assumptions, not measurements. Change them in base_params().

Version 2 adds: self-discharge while parked, key-on pre-charge of the bank, and a cold start
(engine temperature, the 55 C gate on boost and stop-start, a cold-fuel penalty).
The warm results of version 1 are unchanged.

Run:  python3 sim.py            (prints the result tables, writes results.csv, results_cold.csv and trace_*.csv)
"""
import csv, math, copy, sys


def base_params():
    return dict(
        m=198.0,            # kg, 123 kerb (manual) + 75 rider (ASSUMED)
        k_rot=1.05,         # rotating inertia factor (ASSUMED)
        crr=0.015, cda=0.60, rho=1.2, g=9.81,          # road load (ASSUMED)
        r_w=0.30,           # m, rolling radius of 100/90-17 (ASSUMED)
        eta_dl=0.93,        # driveline efficiency (ASSUMED)
        prim=3.250, sec=3.285, gears=[2.917, 1.857, 1.333, 1.050, 0.880],   # manual
        shift_kmh=[12, 22, 33, 45],                    # upshift speeds (ASSUMED)
        rpm_idle=1400.0,    # manual
        rpm_slip=2000.0,    # engine speed while the clutch slips; also lowest regen speed (ASSUMED)
        v_clutch=15.0,      # km/h, clutch pulled below this when slowing (ASSUMED)
        idle_lph=0.15,      # L/h idle fuel (ASSUMED); also sets engine drag
        lhv=30e6,           # J/L, E20 petrol (ASSUMED)
        eta_i=0.36,         # Willans-line slope: marginal engine efficiency (ASSUMED)
        load_w=40.0,        # W, running 12 V load (ASSUMED)
        eta_gen=0.85, eta_mot=0.80,                    # ISG efficiencies (ASSUMED)
        assist_nm=0.55, assist_pmax=346.0,             # manual: +0.55 Nm at 6000 rpm
        assist_const_p=False,                          # False: constant torque (ASSUMED); True: constant 346 W at any rpm
        restart_j=300.0,    # J per engine restart (ASSUMED)
        stop_delay=3,       # s at rest before engine-off (manual: 3-2-1 countdown)
        boost_acc=1.0,      # m/s2: acceleration rising through this requests a boost (ASSUMED)
        feel_dec=0.3,       # m/s2: most deceleration regen may add (ASSUMED)
        handover=True,      # engine off: bank feeds the 12 V load only from energy above the reserve, then the battery does
        # ---- cold start, parking and key-on (used only by run_cold; all ASSUMED unless noted)
        t_amb=30.0,         # C, ambient, and engine temperature after a long park
        t_gate=55.0,        # C, boost and stop-start allowed above this (manual: about 55 C)
        t_full=80.0,        # C, engine fully warm: no cold-fuel penalty above this
        cold_pen=0.15,      # extra fuel at t_amb (15%), fading in a straight line to zero at t_full
        th_cap=6000.0,      # J/K, thermal mass seen by the engine temperature sensor
        th_frac=0.30,       # share of fuel power that heats the engine
        th_h0=8.0, th_hv=0.5,   # W/K cooling at rest, and extra W/K per m/s of road speed
        pre_a=5.0,          # A, pre-charge current limit
        pre_eta=0.90,       # pre-charge stage efficiency
        key_lead_s=5,       # s between key-on and engine start
        leak_ma=1.0,        # mA per cell (Maxwell BCAP0350 datasheet, at rated voltage after 72 h)
        batt_accept_w=None, # W the 12 V battery accepts when CapAssist pays it back (None = no limit)
    )


def load_cycle(path="wmtc_part1.csv", column="reduced_kmh"):
    with open(path) as f:
        return [float(r[column]) for r in csv.DictReader(f)]


# ---------------- boost profiles ----------------
def boost_shape(profile, t):
    """Fraction of full assist, t seconds into the boost."""
    if profile == "full8":                       # stock iGO Assist and CapAssist Power mode
        return 1.0 if t < 8 else 0.0
    if profile == "taper":                       # CapAssist Eco mode: 3 s full + 1 s fade
        if t < 3: return 1.0
        if t < 4: return 0.5
        return 0.0
    return 0.0


BOOST_J = {"full8": 432.0 * 8, "taper": 432.0 * 3.5, None: 0.0}     # J, largest boost of each profile


# ---------------- energy stores ----------------
def uc_store(C=35.0, esr=0.032, vmax=25.0, vmin=12.5, eta_chg=1.0, eta_dis=1.0, eta_gen_load=0.92, eta_uc_load=0.92, n_cells=10):
    """Ultracapacitor bank. eta_chg / eta_dis are the converter between ISG bus and bank (1.0 = direct, Option Y)."""
    return dict(type="uc", C=C, esr=esr, vmax=vmax, vmin=vmin, v=vmin, eta_chg=eta_chg, eta_dis=eta_dis,
                eta_gen_load=eta_gen_load, eta_uc_load=eta_uc_load, n_cells=n_cells)


def li_store(window_wh=20.0, eta=0.95):
    """High-power lithium 12 V battery used the same way (rival design). No converter."""
    return dict(type="li", e=window_wh * 1800.0, e_max=window_wh * 3600.0, eta=eta, eta_chg=1.0, eta_dis=1.0,
                eta_gen_load=1.0, eta_uc_load=1.0, reserve_j=window_wh * 1800.0)


def lead_store(wh=60.0, accept_w=68.0, soc_min=0.80, eta_c=0.85):
    """Stock 12 V lead-acid battery. accept_w = charge power it will take (ASSUMED, swept)."""
    return dict(type="pb", cap=wh * 3600.0, e=wh * 3600.0, accept=accept_w, soc_min=soc_min, eta_c=eta_c, lock=0.0)


def avail(s):                                    # J that can still be taken out
    if s["type"] == "uc": return 0.5 * s["C"] * (s["v"] ** 2 - s["vmin"] ** 2)
    return s["e"]


def room(s):                                     # J that can still be put in
    if s["type"] == "uc": return max(0.0, 0.5 * s["C"] * (s["vmax"] ** 2 - s["v"] ** 2))
    return max(0.0, s["e_max"] - s["e"])


def add(s, j):                                   # j joules at the store terminals in one second (+ in, - out)
    if s["type"] == "uc":
        i = abs(j) / max(s["v"], 1e-6)
        e = 0.5 * s["C"] * s["v"] ** 2 + j - i * i * s["esr"]
        s["v"] = math.sqrt(max(0.0, 2.0 * e / s["C"]))
    else:
        s["e"] += j * s["eta"] if j > 0 else j / s["eta"]


# ---------------- self-discharge while parked ----------------
def parked_voltage(v0, hours, n_cells=10, c_cell=350.0, leak_ma=1.0, balancing_on=False, v_rated=2.5):
    """Bank voltage after standing for `hours`, starting from v0.

    Each cell leaks a constant leak_ma (worst case: real leakage falls with voltage).
    balancing_on=True adds a resistor on each cell that passes 10 x leak_ma at rated voltage."""
    vc = v0 / n_cells
    leak = leak_ma / 1000.0
    r_bal = v_rated / (10.0 * leak) if leak > 0 else float("inf")
    dt = 60.0
    for _ in range(int(hours * 3600 / dt)):
        i = leak + (vc / r_bal if balancing_on else 0.0)
        vc = max(0.0, vc - i * dt / c_cell)
        if vc <= 0: break
    return vc * n_cells


# ---------------- one pass over the cycle ----------------
def one_pass(cyc, case, s, p, st=None):
    """st carries state between passes for a cold run: engine temperature T, bank switch, battery debt.
    With st=None the engine is warm and the bank is connected (the version 1 behaviour)."""
    kind = case["kind"]                          # "conv", "igo" (lead-acid), "cap" (UC or lithium, CapAssist control)
    gen_max = case.get("gen_w", 160.0)
    profile = case.get("profile")
    n = len(cyc)
    w_idle = p["rpm_idle"] * 2 * math.pi / 60
    idle_fuel_w = p["idle_lph"] * p["lhv"] / 3600.0
    if kind == "cap":
        reserve = s.get("reserve_j", BOOST_J[profile] * 1.15 * case.get("reserve_n", 1) + p["restart_j"])
    R = dict(fuel_j=0.0, free_j=0.0, genfuel_j=0.0, off_s=0, blocked=0, req=0, full=0, part=0, denied=0,
             boost_j=0.0, batt_out_j=0.0, batt_pulses=0, vmin=99.0, vmax=0.0, events=[], trace=[])
    rest = 0; engine_on = True; prev_a = 0.0; debt = 0.0
    b_t = None; b_ok = True; b_e = 0.0; b_start = 0
    st = st if st is not None else {}
    T = st.get("T")                               # engine temperature, C; None = warm engine, no thermal model
    bank_on = st.get("bank_on", True)             # False while the bank is isolated and pre-charging
    debt = st.get("debt", 0.0)                    # J the 12 V battery has supplied and not yet got back (CapAssist cases)
    R.update(gated=0, t_warm=None, t_bank_on=None, t_ready=None, pre_j=0.0, debt_max=debt)
    pre = st.pop("pre", None)                     # what happened at key-on, before the first second
    if pre:
        R["batt_out_j"] += pre["batt_j"]; R["batt_pulses"] += pre["pulses"]; R["pre_j"] += pre["bank_j"]

    for k in range(n):
        warm = T is None or T >= p["t_gate"]      # boost and stop-start need a warm engine
        bo0 = R["batt_out_j"]                     # to log what the 12 V battery supplies in this second
        v = cyc[k] / 3.6
        v_next = cyc[k + 1] / 3.6 if k + 1 < n else 0.0
        a = v_next - v                           # m/s2 over this second
        vm = 0.5 * (v + v_next); kmh = vm * 3.6
        moving = vm > 0.01

        # ---- engine stop-start
        if moving:
            if not engine_on:
                engine_on = True
                if kind == "igo": s["e"] -= p["restart_j"]; R["batt_out_j"] += p["restart_j"]; R["batt_pulses"] += 1
                elif kind == "cap": add(s, -p["restart_j"] / s["eta_dis"])
            rest = 0
        else:
            rest += 1
            if engine_on and case.get("stopstart") and rest > p["stop_delay"] and warm and bank_on:
                ok = True
                if kind == "igo": ok = s["e"] >= s["soc_min"] * s["cap"]
                if kind == "cap": ok = avail(s) >= 1.5 * p["restart_j"]
                if ok: engine_on = False
                elif rest == p["stop_delay"] + 1: R["blocked"] += 1

        # ---- road load, gear, engine speed
        f = (p["m"] * p["g"] * p["crr"] if moving else 0.0) + 0.5 * p["rho"] * p["cda"] * vm ** 2 + p["m"] * p["k_rot"] * a
        p_wheel = f * vm
        gi = sum(1 for sk in p["shift_kmh"] if kmh >= sk)
        ratio = p["prim"] * p["gears"][gi] * p["sec"]
        rpm_w = vm / p["r_w"] * ratio * 60 / (2 * math.pi)
        driving = moving and p_wheel > 0
        if driving:
            coupled = True; rpm = max(rpm_w, p["rpm_slip"])
        elif moving and kmh >= p["v_clutch"] and rpm_w >= p["rpm_slip"]:
            coupled = True; rpm = rpm_w            # overrun, clutch engaged
        else:
            coupled = False; rpm = p["rpm_idle"]   # clutch pulled or standing
        w = rpm * 2 * math.pi / 60
        fric_fuel = idle_fuel_w * w / w_idle       # fuel power that only covers engine friction
        p_drag = fric_fuel * p["eta_i"]            # engine braking power with fuel cut
        if coupled:
            p_e0 = p_wheel / p["eta_dl"] if p_wheel >= 0 else p_wheel * p["eta_dl"]
        else:
            p_e0 = 0.0
        # braking power left after engine braking: the only regen that costs no fuel
        free_mech = max(0.0, -p_e0 - p_drag) if (coupled and engine_on) else 0.0

        # ---- boost
        assist_el = 0.0; assist_mech = 0.0
        if kind in ("igo", "cap") and profile:
            if b_t is None and moving and a >= p["boost_acc"] and prev_a < p["boost_acc"]:
                R["req"] += 1
                if not warm:                       # refused by the engine temperature gate, stock and CapAssist alike
                    R["gated"] += 1; R["events"].append((k + 1, "engine cold", 0.0, k + 1))
                else:
                    if kind == "igo": go = s["lock"] <= 0 and s["e"] >= s["soc_min"] * s["cap"]
                    else: go = bank_on and avail(s) >= 432.0 / s["eta_dis"] * 1.05
                    if go: b_t = 0.0; b_e = 0.0; b_ok = True; b_start = k + 1
                    else: R["denied"] += 1; R["events"].append((k + 1, "denied", 0.0, k + 1))
            if b_t is not None:
                sh = boost_shape(profile, b_t)
                if sh <= 0 or a <= 0:              # boost over
                    R["boost_j"] += b_e
                    R["full" if b_ok else "part"] += 1
                    R["events"].append((b_start, "full" if b_ok else "cut short", b_e / 3600, k + 1))
                    if kind == "igo": s["lock"] = b_e; R["batt_pulses"] += 1
                    b_t = None
                else:
                    pm = (p["assist_pmax"] if p["assist_const_p"] else min(p["assist_nm"] * w, p["assist_pmax"])) * sh
                    pe = pm / p["eta_mot"]
                    if kind == "cap":
                        need = pe / s["eta_dis"]
                        if avail(s) < need * 1.05: pe = 0.0; pm = 0.0; b_ok = False
                        else: add(s, -need)
                    else:
                        s["e"] -= pe; R["batt_out_j"] += pe
                    assist_el, assist_mech = pe, pm; b_e += pe; b_t += 1.0
        prev_a = a

        # ---- electrical system: who feeds the 12 V load, what the generator does
        gen_el = 0.0
        if kind == "conv":
            gen_el = p["load_w"] if engine_on else 0.0
        elif kind == "igo":
            if engine_on:
                chg = 0.0
                if assist_el == 0:
                    chg = min(s["accept"], (s["cap"] - s["e"]) / s["eta_c"], max(0.0, gen_max - p["load_w"]))
                gen_el = p["load_w"] + chg if assist_el == 0 else 0.0
                if assist_el > 0: s["e"] -= p["load_w"]; R["batt_out_j"] += p["load_w"]
                s["e"] += chg * s["eta_c"]
                s["lock"] = max(0.0, s["lock"] - chg * s["eta_c"])   # boost returns once its energy is back
            else:
                s["e"] -= p["load_w"]; R["batt_out_j"] += p["load_w"]
        elif not bank_on:
            # Bank isolated (below 12.5 V at key-on): the controller is on the 12 V battery, as on the stock bike,
            # and the pre-charge stage fills the bank at constant current. No boost, regen or stop-start yet.
            pre_src = 0.0
            if s["v"] < s["vmin"]:
                v_new = min(s["vmin"], s["v"] + p["pre_a"] / s["C"])
                de = 0.5 * s["C"] * (v_new ** 2 - s["v"] ** 2)
                pre_src = (de + p["pre_a"] ** 2 * s["esr"]) / p["pre_eta"]
                R["pre_j"] += de; s["v"] = v_new
            want = p["load_w"] + pre_src
            gen_el = min(gen_max, want) if engine_on else 0.0
            if want > gen_el: debt += want - gen_el; R["batt_out_j"] += want - gen_el
            if debt > 0 and engine_on and gen_el < gen_max:
                lim = gen_max - gen_el if p["batt_accept_w"] is None else min(gen_max - gen_el, p["batt_accept_w"])
                pay = min(debt / 0.85, lim); gen_el += pay; debt -= pay * 0.85
            if s["v"] >= s["vmin"]: bank_on = True; R["t_bank_on"] = k + 1     # bank switch closes
        else:
            ld_gen = p["load_w"] / s["eta_gen_load"]     # generator output needed to run the 12 V load
            ld_uc = p["load_w"] / s["eta_uc_load"]       # bank output needed to run the 12 V load
            if not engine_on:
                keep = reserve if p["handover"] else 1.5 * p["restart_j"]     # what the bank must still hold
                if avail(s) - keep > ld_uc: add(s, -ld_uc)                     # spare energy runs the load
                else: debt += p["load_w"]; R["batt_out_j"] += p["load_w"]      # 12 V battery carries the load
            elif assist_el > 0:
                if avail(s) > ld_uc: add(s, -ld_uc)
                else: debt += p["load_w"]; R["batt_out_j"] += p["load_w"]
            else:
                above = avail(s) - reserve
                free_el = 0.0
                if free_mech > 0:
                    feel = p["feel_dec"] * p["m"] * vm * p["eta_gen"]
                    free_el = min(gen_max, free_mech * p["eta_gen"], feel)
                if free_el > 0:
                    to_load = min(free_el, ld_gen)
                    to_bank = min(free_el - to_load, room(s) / s["eta_chg"])
                    add(s, to_bank * s["eta_chg"])
                    gen_el = to_load + to_bank
                    short = p["load_w"] - to_load * s["eta_gen_load"]      # part of the load not yet covered
                    if short > 1e-9:
                        if above > 0: add(s, -short / s["eta_uc_load"])
                        else: gen_el += short / s["eta_gen_load"]
                elif above > 2.0 * ld_uc:
                    add(s, -ld_uc)                         # run the load on stored energy, generator off
                elif above >= 0:
                    gen_el = ld_gen                        # at the reserve: generator carries the load, bank rests
                else:
                    top = min(max(0.0, gen_max - ld_gen), -above / s["eta_chg"])
                    gen_el = ld_gen + top
                    add(s, top * s["eta_chg"])
                if debt > 0 and gen_el < gen_max:          # pay the 12 V battery back
                    lim = gen_max - gen_el if p["batt_accept_w"] is None else min(gen_max - gen_el, p["batt_accept_w"])
                    pay = min(debt / 0.85, lim); gen_el += pay; debt -= pay * 0.85

        # ---- fuel (cf = cold-fuel factor, 1.0 when warm)
        cf = 1.0
        if T is not None:
            cf = 1.0 + p["cold_pen"] * min(1.0, max(0.0, (p["t_full"] - T) / (p["t_full"] - p["t_amb"])))
        if engine_on:
            p_e = p_e0 + gen_el / p["eta_gen"] - assist_mech
            fuel_w = cf * max(0.0, fric_fuel + p_e / p["eta_i"])
            fuel_nogen = cf * max(0.0, fric_fuel + (p_e0 - assist_mech) / p["eta_i"])
            R["genfuel_j"] += fuel_w - fuel_nogen
            if gen_el > 0:
                paid = (fuel_w - fuel_nogen) / cf * p["eta_i"] * p["eta_gen"]
                R["free_j"] += max(0.0, gen_el - paid)
        else:
            fuel_w = 0.0; R["off_s"] += 1
        R["fuel_j"] += fuel_w
        # ---- engine temperature and readiness markers
        if T is not None:
            T += (p["th_frac"] * fuel_w - (p["th_h0"] + p["th_hv"] * vm) * (T - p["t_amb"])) / p["th_cap"]
            if R["t_warm"] is None and T >= p["t_gate"]: R["t_warm"] = k + 1
        if kind == "cap":
            R["debt_max"] = max(R["debt_max"], debt)
            if R["t_ready"] is None and bank_on and avail(s) >= reserve - 1.0: R["t_ready"] = k + 1
        if kind == "cap" and s["type"] == "uc":
            R["vmin"] = min(R["vmin"], s["v"]); R["vmax"] = max(R["vmax"], s["v"])
        state = s["v"] if (kind == "cap" and s["type"] == "uc") else 0.0
        res_met = int(kind == "cap" and bank_on and avail(s) >= reserve - 1.0)
        soc = s["e"] / s["cap"] * 100 if kind == "igo" else 0.0
        R["trace"].append((k + 1, cyc[k], state, assist_el, gen_el, fuel_w * 1000 / p["lhv"], int(engine_on),
                           T if T is not None else 0.0, int(bank_on), res_met, R["batt_out_j"] - bo0, soc))

    dist = sum(cyc) / 3.6
    litres = R["fuel_j"] / p["lhv"]
    R.update(dist=dist, fuel_ml=litres * 1000, kmpl=dist / 1000 / litres, boost_wh=R["boost_j"] / 3600,
             free_wh=R["free_j"] / 3600, genfuel_ml=R["genfuel_j"] / p["lhv"] * 1000, batt_wh=R["batt_out_j"] / 3600,
             debt_end=debt, t_end=T)
    st.update(T=T, bank_on=bank_on, debt=debt)
    return R


def run(cyc, case, p=None, reps=6):
    """Repeat the cycle so the store starts each pass as it ended the last; report the final pass."""
    p = p or base_params()
    s = copy.deepcopy(case.get("store"))
    if s and s["type"] == "uc":
        s["v"] = s["vmax"] * 0.8
    for _ in range(reps):
        r = one_pass(cyc, case, s, p)
    return r


def reserve_of(case, s, p):
    return s.get("reserve_j", BOOST_J[case.get("profile")] * 1.15 * case.get("reserve_n", 1) + p["restart_j"])


def run_cold(cyc, case, p=None, park_h=12.0, balancing_on=False):
    """Cold start after the bike has stood for park_h hours: one cold pass, then one hot pass.

    This is the WMTC order for a Class 1 motorcycle (Part 1 cold, Part 1 hot, weighted 50/50, GTR No. 2).
    Returns (cold, hot, info). Nothing is repeated to a steady state: the starting state is the point."""
    p = p or base_params()
    kind = case["kind"]
    s = copy.deepcopy(case.get("store"))
    st = dict(T=p["t_amb"], debt=0.0, bank_on=True)
    info = dict(v_key=None, v_off=None, pre_batt_wh=0.0)
    pre = dict(batt_j=0.0, pulses=0, bank_j=0.0)
    if kind == "cap" and s["type"] == "uc":
        v_off = math.sqrt(s["vmin"] ** 2 + 2.0 * reserve_of(case, s, p) / s["C"])     # bank left at its reserve at key-off
        s["v"] = parked_voltage(v_off, park_h, s["n_cells"], s["C"] * s["n_cells"], p["leak_ma"], balancing_on)
        info.update(v_off=v_off, v_key=s["v"])
        st["bank_on"] = s["v"] >= s["vmin"]
        for _ in range(int(p["key_lead_s"])):          # key on, engine not yet started: the battery pre-charges
            if s["v"] < s["vmin"]:
                v_new = min(s["vmin"], s["v"] + p["pre_a"] / s["C"])
                de = 0.5 * s["C"] * (v_new ** 2 - s["v"] ** 2)
                src = (de + p["pre_a"] ** 2 * s["esr"]) / p["pre_eta"]
                pre["batt_j"] += src; pre["bank_j"] += de; st["debt"] += src; s["v"] = v_new
        if s["v"] >= s["vmin"]: st["bank_on"] = True
        info["pre_batt_wh"] = pre["batt_j"] / 3600          # pre-charge energy the battery supplied before the engine started
    if kind in ("igo", "cap"):                         # first start of the day: the 12 V battery cranks the engine
        pre["batt_j"] += p["restart_j"]; pre["pulses"] += 1
        if kind == "igo": s["e"] -= p["restart_j"]
        else: st["debt"] += p["restart_j"]
    st["pre"] = pre
    cold = one_pass(cyc, case, s, p, st)
    hot = one_pass(cyc, case, s, p, st)
    for r in (cold, hot):
        r["deficit_wh"] = 0.0
    if kind == "igo":
        hot["deficit_wh"] = (s["cap"] - s["e"]) / 3600
    elif kind == "cap":
        cold["deficit_wh"] = cold["debt_end"] / 3600; hot["deficit_wh"] = hot["debt_end"] / 3600
    info["kmpl_weighted"] = cold["dist"] / 1000 / (0.5 * (cold["fuel_ml"] + hot["fuel_ml"]) / 1000)
    return cold, hot, info


# ---------------- cases ----------------
def cases():
    y = uc_store()                                               # Option Y: bank directly on the ISG bus
    x = uc_store(eta_chg=0.92, eta_dis=0.92, eta_gen_load=1.0)   # Option X: 12 V controller + two-way converter
    y_old = uc_store(C=28.0, esr=0.064, vmax=23.0)               # end of life (-20% C, 2x ESR) and hot (23 V limit)
    ss = dict(stopstart=True)
    return [
        ("A", "Conventional, no assist or stop-start", dict(kind="conv")),
        ("B1", "Stock iGO Assist, battery takes 34 W", dict(kind="igo", profile="full8", store=lead_store(accept_w=34), **ss)),
        ("B2", "Stock iGO Assist, battery takes 68 W", dict(kind="igo", profile="full8", store=lead_store(accept_w=68), **ss)),
        ("B3", "Stock iGO Assist, battery takes 120 W", dict(kind="igo", profile="full8", store=lead_store(accept_w=120), **ss)),
        ("C", "CapAssist X, Eco, 160 W", dict(kind="cap", gen_w=160, profile="taper", reserve_n=2, store=x, **ss)),
        ("D0", "CapAssist Y, Eco, 160 W, one-boost reserve", dict(kind="cap", gen_w=160, profile="taper", reserve_n=1, store=y, **ss)),
        ("D", "CapAssist Y, Eco, 160 W", dict(kind="cap", gen_w=160, profile="taper", reserve_n=2, store=y, **ss)),
        ("DP", "CapAssist Y, Power, 160 W", dict(kind="cap", gen_w=160, profile="full8", reserve_n=1, store=y, **ss)),
        ("DA", "CapAssist Y, Eco, 160 W, aged and hot bank", dict(kind="cap", gen_w=160, profile="taper", reserve_n=2, store=y_old, **ss)),
        ("E", "CapAssist Y, Eco, 430 W generator", dict(kind="cap", gen_w=430, profile="taper", reserve_n=2, store=y, **ss)),
        ("D8", "CapAssist Y, Eco, 160 W, 8-cell bank (20 V)", dict(kind="cap", gen_w=160, profile="taper", reserve_n=2, store=uc_store(C=43.75, esr=0.0256, vmax=20.0, n_cells=8), **ss)),
        ("F", "High-power lithium 12 V, Eco, 160 W", dict(kind="cap", gen_w=160, profile="taper", store=li_store(), **ss)),
    ]


HDR = "%-4s %-44s %7s %6s %4s %4s %4s %4s %7s %7s %7s %6s %6s %5s %5s" % (
    "id", "case", "fuel mL", "km/L", "req", "full", "cut", "den", "boostWh", "freeWh", "battWh", "pulses", "off s", "Vmin", "Vmax")


def row(cid, name, r):
    return "%-4s %-44s %7.1f %6.1f %4d %4d %4d %4d %7.2f %7.2f %7.2f %6d %6d %5.1f %5.1f" % (
        cid, name, r["fuel_ml"], r["kmpl"], r["req"], r["full"], r["part"], r["denied"], r["boost_wh"], r["free_wh"],
        r["batt_wh"], r["batt_pulses"], r["off_s"], r["vmin"] if r["vmin"] < 99 else 0, r["vmax"])


if __name__ == "__main__":
    cyc = load_cycle()
    print("WMTC Part 1, reduced speed: %d s, %.0f m" % (len(cyc), sum(cyc) / 3.6))
    print(HDR)
    out = []
    for cid, name, c in cases():
        r = run(cyc, c); out.append((cid, name, r)); print(row(cid, name, r))
        if cid in ("B2", "D", "DP"):
            with open("trace_%s.csv" % cid, "w", newline="") as f:
                wr = csv.writer(f); wr.writerow(["time_s", "speed_kmh", "uc_v", "assist_w", "gen_w", "fuel_ml_s", "engine_on", "engine_temp_c", "bank_connected", "reserve_met", "battery_out_w", "battery_soc_pct"])
                wr.writerows(r["trace"])
    with open("results.csv", "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["id", "case", "fuel_ml", "km_per_l", "boost_requests", "boosts_full", "boosts_cut_short", "boosts_denied",
                     "boost_wh", "free_regen_wh", "battery_out_wh", "battery_pulses", "engine_off_s", "uc_vmin", "uc_vmax"])
        for cid, name, r in out:
            wr.writerow([cid, name, round(r["fuel_ml"], 2), round(r["kmpl"], 2), r["req"], r["full"], r["part"], r["denied"],
                         round(r["boost_wh"], 3), round(r["free_wh"], 3), round(r["batt_wh"], 3), r["batt_pulses"], r["off_s"],
                         round(r["vmin"], 2) if r["vmin"] < 99 else "", round(r["vmax"], 2) if r["vmax"] > 0 else ""])

    print("\nSensitivity (B2 stock vs D CapAssist Y Eco):")
    cs = {cid: c for cid, _, c in cases()}
    sens = [("base", {}, "reduced_kmh"), ("idle fuel 0.10 L/h (less engine drag)", dict(idle_lph=0.10), "reduced_kmh"),
            ("253 kg (two-up, laden)", dict(m=253.0), "reduced_kmh"), ("normal-speed Part 1", {}, "normal_kmh"),
            ("load 60 W (headlamp on)", dict(load_w=60.0), "reduced_kmh"),
            ("assist at constant 346 W (not constant torque)", dict(assist_const_p=True), "reduced_kmh")]
    for label, chg, col in sens:
        p = base_params(); p.update(chg); cy = load_cycle(column=col)
        ra = run(cy, cs["A"], p); rb = run(cy, cs["B2"], p); rd = run(cy, cs["D"], p); re_ = run(cy, cs["E"], p); rp = run(cy, cs["DP"], p)
        print("  %-46s A %.1f | B2 %.1f km/L %d/%d full, %.2f Wh boost, free %.2f, batt %.2f Wh | D %.1f km/L %d/%d, %.2f Wh, free %.2f, V %.1f-%.1f | DP %d/%d | E %.1f km/L free %.2f" % (
            label, ra["kmpl"], rb["kmpl"], rb["full"], rb["req"], rb["boost_wh"], rb["free_wh"], rb["batt_wh"], rd["kmpl"], rd["full"], rd["req"], rd["boost_wh"], rd["free_wh"],
            rd["vmin"], rd["vmax"], rp["full"], rp["req"], re_["kmpl"], re_["free_wh"]))
    print("\nBoost by boost (start s, result, Wh):")
    for cid in ("B1", "B2", "B3", "D0", "D", "DP"):
        r = [x for x in out if x[0] == cid][0][2]
        print("  %-3s" % cid, "  ".join("%d:%s:%.2f" % e[:3] for e in sorted(r["events"])))

    # ---------------- cold start after parking ----------------
    print("\nCold start after parking: Part 1 cold, then Part 1 hot (WMTC Class 1 order, weighted 50/50)")
    print("  times in s from engine start; boosts are for the cold pass: full / requested (g = refused by the 55 C gate)")
    CH = "  %-40s %5s %6s %6s %5s  %-12s %6s %7s %7s %7s %7s" % (
        "case", "Vkey", "switch", "ready", "warm", "cold boosts", "off s", "battWh", "cold mL", "hot mL", "km/L")
    print(CH)

    def cold_row(label, cid, park_h, chg=None, bal=False):
        p = base_params(); p.update(chg or {})
        c, h, info = run_cold(cyc, cs[cid], p, park_h, bal)
        f = lambda x: "-" if x is None else "%d" % x
        vk = "-" if info["v_key"] is None else "%.1f" % info["v_key"]
        print("  %-40s %5s %6s %6s %5s  %2d/%-2d g%-5d %6d %7.2f %7.2f %7.2f %7.2f" % (
            label, vk, f(c["t_bank_on"]), f(c["t_ready"]), f(c["t_warm"]), c["full"], c["req"], c["gated"],
            c["off_s"], c["batt_wh"], c["fuel_ml"], h["fuel_ml"], info["kmpl_weighted"]))
        return [label, cid, park_h, vk, f(c["t_bank_on"]), f(c["t_ready"]), f(c["t_warm"]), c["req"], c["gated"], c["full"],
                c["part"], c["denied"], c["off_s"], round(c["batt_wh"], 3), c["batt_pulses"], round(info["pre_batt_wh"], 3),
                round(c["fuel_ml"], 2), round(h["fuel_ml"], 2), round(info["kmpl_weighted"], 2)], c

    rows = []
    rows.append(cold_row("A  conventional", "A", 12)[0])
    for b, w in (("B1", 34), ("B2", 68), ("B3", 120)):
        rows.append(cold_row("%s stock iGO Assist, battery takes %d W" % (b, w), b, 12)[0])
    for hrs, name in ((12, "overnight, 12 h"), (60, "a weekend, 60 h"), (168, "a week"), (720, "a month")):
        r, c = cold_row("D  CapAssist Y Eco, parked %s" % name, "D", hrs); rows.append(r)
        if hrs == 720:
            with open("trace_cold_D.csv", "w", newline="") as f:
                wr = csv.writer(f); wr.writerow(["time_s", "speed_kmh", "uc_v", "assist_w", "gen_w", "fuel_ml_s", "engine_on", "engine_temp_c", "bank_connected", "reserve_met", "battery_out_w", "battery_soc_pct"])
                wr.writerows(c["trace"])
    rows.append(cold_row("D  Eco, 12 h, balancing left connected", "D", 12, bal=True)[0])
    rows.append(cold_row("DP CapAssist Y Power, parked 12 h", "DP", 12)[0])
    rows.append(cold_row("DP CapAssist Y Power, parked a month", "DP", 720)[0])
    print("  Sensitivity: D, Eco, parked a month (bank empty)")
    for label, chg in (("  engine warms twice as fast", dict(th_cap=3000.0)), ("  engine warms half as fast", dict(th_cap=12000.0)),
                       ("  ambient 15 C", dict(t_amb=15.0)), ("  pre-charge at 2.5 A", dict(pre_a=2.5)),
                       ("  pre-charge at 10 A", dict(pre_a=10.0)), ("  battery pay-back limited to 34 W", dict(batt_accept_w=34.0))):
        rows.append(cold_row(label, "D", 720, chg)[0])
    with open("results_cold.csv", "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["case", "id", "parked_h", "bank_v_at_key_on", "bank_switch_closes_s", "bank_at_reserve_s", "engine_warm_s",
                     "cold_boost_requests", "cold_refused_engine_cold", "cold_boosts_full", "cold_boosts_cut_short", "cold_boosts_denied",
                     "cold_engine_off_s", "cold_battery_out_wh", "cold_battery_pulses", "precharge_from_battery_wh",
                     "cold_fuel_ml", "hot_fuel_ml", "weighted_km_per_l"])
        wr.writerows(rows)
    print("\nBank voltage after parking, from the 19.3 V Eco reserve (1 mA per cell):")
    for hrs in (12, 24, 60, 72, 168):
        print("  %4d h: %5.1f V   (balancing left connected: %5.1f V)" % (hrs, parked_voltage(19.29, hrs), parked_voltage(19.29, hrs, balancing_on=True)))
