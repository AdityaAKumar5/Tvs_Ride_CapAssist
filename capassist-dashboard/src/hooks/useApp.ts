import { create } from 'zustand';
import type { Condition, DataBundle, RawFiles } from '../types';
import { buildBundle } from '../data/build';
import { fetchRawFiles } from '../data/load';
import { mapSelection } from '../utils/scenario';

export interface Bookmark { name: string; condition: Condition; warmId: string; coldKey: string; compareA: string; compareB: string; }

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  raw: RawFiles;
  data: DataBundle | null;
  imported: string[];              // files replaced through Data Import this session
  condition: Condition;
  warmId: string;
  coldKey: string;
  compareA: string;                // selection strings, e.g. "warm:B2"
  compareB: string;
  theme: 'light' | 'dark';
  presenting: boolean;
  bookmarks: Bookmark[];
  load: () => Promise<void>;
  replaceFiles: (files: RawFiles) => string | null;
  setCondition: (c: Condition) => void;
  setScenario: (key: string) => void;
  setColdKey: (key: string) => void;
  setCompare: (side: 'A' | 'B', sel: string) => void;
  toggleTheme: () => void;
  setPresenting: (p: boolean) => void;
  addBookmark: (name: string) => void;
  applyBookmark: (b: Bookmark) => void;
  removeBookmark: (name: string) => void;
}

function readBookmarks(): Bookmark[] {
  try { return JSON.parse(sessionStorage.getItem('capassist.bookmarks') ?? '[]') as Bookmark[]; } catch { return []; }
}
function writeBookmarks(b: Bookmark[]): void {
  try { sessionStorage.setItem('capassist.bookmarks', JSON.stringify(b)); } catch { /* storage unavailable: keep in memory */ }
}

export const useApp = create<AppState>((set, get) => ({
  status: 'loading', error: null, raw: {}, data: null, imported: [],
  condition: 'warm', warmId: 'D', coldKey: 'D_park_12h', compareA: 'warm:B2', compareB: 'warm:D',
  theme: 'light', presenting: false, bookmarks: readBookmarks(),

  load: async () => {
    try {
      const raw = await fetchRawFiles();
      set({ raw, data: buildBundle(raw), status: 'ready', error: null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  // Replace some files with uploaded ones. All-or-nothing: a bad file leaves the current data in place.
  replaceFiles: (files) => {
    const raw = { ...get().raw, ...files };
    try {
      const data = buildBundle(raw);
      const s = get();
      set({ raw, data, imported: [...new Set([...s.imported, ...Object.keys(files)])],
        warmId: data.warm.scenarios[s.warmId] ? s.warmId : data.warm.order[0],
        coldKey: data.cold.scenarios[s.coldKey] ? s.coldKey : data.cold.order[0] });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },

  setCondition: (c) => {
    const s = get();
    if (!s.data) { set({ condition: c }); return; }
    set({ condition: c, ...mapSelection(s.data, c, s.warmId, s.coldKey) });
  },
  setScenario: (key) => (get().condition === 'warm' ? set({ warmId: key }) : set({ coldKey: key })),
  setColdKey: (key) => set({ coldKey: key }),
  setCompare: (side, sel) => (side === 'A' ? set({ compareA: sel }) : set({ compareB: sel })),
  toggleTheme: () => {
    const theme = get().theme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  setPresenting: (p) => {
    document.documentElement.classList.toggle('present', p);
    set({ presenting: p });
  },
  addBookmark: (name) => {
    const s = get();
    const b: Bookmark = { name, condition: s.condition, warmId: s.warmId, coldKey: s.coldKey, compareA: s.compareA, compareB: s.compareB };
    const bookmarks = [...s.bookmarks.filter((x) => x.name !== name), b];
    writeBookmarks(bookmarks); set({ bookmarks });
  },
  applyBookmark: (b) => set({ condition: b.condition, warmId: b.warmId, coldKey: b.coldKey, compareA: b.compareA, compareB: b.compareB }),
  removeBookmark: (name) => {
    const bookmarks = get().bookmarks.filter((x) => x.name !== name);
    writeBookmarks(bookmarks); set({ bookmarks });
  },
}));
