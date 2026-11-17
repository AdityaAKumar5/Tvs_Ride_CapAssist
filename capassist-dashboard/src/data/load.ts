import type { RawFiles } from '../types';
import { ALL_FILES } from './schemas';

/** Fetch every data file from public/data. Works offline once the app is installed. */
export async function fetchRawFiles(): Promise<RawFiles> {
  const out: RawFiles = {};
  await Promise.all(ALL_FILES.map(async (name) => {
    const res = await fetch(`./data/${name}`);
    if (!res.ok) throw new Error(`Could not load data/${name} (${res.status})`);
    out[name] = await res.text();
  }));
  return out;
}
