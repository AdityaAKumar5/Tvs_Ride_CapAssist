import Papa from 'papaparse';
import { SCHEMAS } from './schemas';

/** '-', blank and null mean "missing", never zero. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** For counts that must exist: missing becomes 0 only where the schema guarantees a count. */
export function count(v: unknown): number {
  return num(v) ?? 0;
}

export type Row = Record<string, string>;

export function parseCsv(name: string, text: string): Row[] {
  const out = Papa.parse<Row>(text.trim(), { header: true, skipEmptyLines: true });
  const fields = out.meta.fields ?? [];
  const need = SCHEMAS[name] ?? [];
  const missing = need.filter((c) => !fields.includes(c));
  if (missing.length) throw new Error(`${name}: missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`);
  if (!out.data.length) throw new Error(`${name}: no rows`);
  return out.data;
}

/** Check a file without building anything: used by the Data Import dialog. */
export function validateFile(name: string, text: string): { ok: boolean; rows: number; message: string } {
  try {
    if (name.endsWith('.json')) {
      const j = JSON.parse(text);
      if (!Array.isArray(j.scenarios)) throw new Error(`${name}: no "scenarios" list`);
      return { ok: true, rows: j.scenarios.length, message: `${j.scenarios.length} scenarios` };
    }
    const rows = parseCsv(name, text);
    return { ok: true, rows: rows.length, message: `${rows.length} rows, schema OK` };
  } catch (e) {
    return { ok: false, rows: 0, message: e instanceof Error ? e.message : String(e) };
  }
}
