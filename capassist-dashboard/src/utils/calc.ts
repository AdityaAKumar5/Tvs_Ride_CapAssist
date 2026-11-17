// Engineering calculation utilities. Everything here is a simplified estimate and is labelled so in the UI.

/** Boost availability = 100 x full boosts / total requests. No requests means not applicable, not 0%. */
export function availability(full: number, requests: number): number | null {
  if (!requests || requests <= 0) return null;
  return (100 * full) / requests;
}

export function fmt(v: number | null | undefined, digits = 1, unit = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(digits)}${unit ? ' ' + unit : ''}`;
}

export function fmtInt(v: number | null | undefined, unit = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return `${Math.round(v)}${unit ? ' ' + unit : ''}`;
}

export interface BankInputs {
  cells: number;          // cells in series
  cellF: number;          // F per cell
  vMax: number;           // V, bank
  vMin: number;           // V, bank
  esrMilliOhm: number;    // mOhm, whole bank
  boostW: number;         // W electrical at the machine
  boostS: number;         // s
  efficiency: number;     // converter efficiency between bank and machine, 0..1
  vNow: number;           // V, present bank voltage
}

export interface BankOutputs {
  ceq: number; eMaxWh: number; eUsableWh: number; eRemainingWh: number; headroomWh: number;
  boostNeedWh: number; currentAtNow: number | null; currentAtMin: number; lossWh: number | null; boostsFromNow: number;
}

const J = 3600;

/** Series bank: Ceq = Ccell / N.  Usable energy: E = 0.5 x Ceq x (Vmax^2 - Vmin^2). */
export function bankCalc(i: BankInputs): BankOutputs {
  const ceq = i.cellF / Math.max(1, i.cells);
  const e = (v: number) => 0.5 * ceq * v * v;
  const eMax = e(i.vMax);
  const usable = Math.max(0, e(i.vMax) - e(i.vMin));
  const vNow = Math.min(i.vMax, Math.max(0, i.vNow));
  const remaining = Math.max(0, e(vNow) - e(i.vMin));
  const headroom = Math.max(0, e(i.vMax) - e(vNow));
  const pBank = i.boostW / Math.max(0.01, i.efficiency);          // W drawn from the bank
  const need = pBank * i.boostS;                                    // J
  const r = i.esrMilliOhm / 1000;
  const currentAtNow = vNow > 0.5 ? pBank / vNow : null;
  const currentAtMin = pBank / Math.max(0.5, i.vMin);
  const loss = currentAtNow === null ? null : currentAtNow * currentAtNow * r * i.boostS; // J, at constant current
  const perBoost = need + (loss ?? 0);
  return {
    ceq, eMaxWh: eMax / J, eUsableWh: usable / J, eRemainingWh: remaining / J, headroomWh: headroom / J,
    boostNeedWh: need / J, currentAtNow, currentAtMin, lossWh: loss === null ? null : loss / J,
    boostsFromNow: perBoost > 0 ? remaining / perBoost : 0,
  };
}

/** Points for the usable-energy-against-voltage curve. */
export function energyCurve(i: BankInputs, steps = 40): { v: number; wh: number }[] {
  const ceq = i.cellF / Math.max(1, i.cells);
  const out: { v: number; wh: number }[] = [];
  for (let k = 0; k <= steps; k++) {
    const v = i.vMin + ((i.vMax - i.vMin) * k) / steps;
    out.push({ v: Number(v.toFixed(2)), wh: Number(((0.5 * ceq * (v * v - i.vMin * i.vMin)) / J).toFixed(4)) });
  }
  return out;
}

/** Nominal electrical power profile of each assist mode, from the design specification (not measured). */
export function nominalProfile(mode: 'eco' | 'power', pMax = 432): { t: number; w: number }[] {
  if (mode === 'eco') return [{ t: 0, w: 0 }, { t: 0, w: pMax }, { t: 3, w: pMax }, { t: 3, w: pMax / 2 }, { t: 4, w: pMax / 2 }, { t: 4, w: 0 }, { t: 9, w: 0 }];
  return [{ t: 0, w: 0 }, { t: 0, w: pMax }, { t: 8, w: pMax }, { t: 8, w: 0 }, { t: 9, w: 0 }];
}
