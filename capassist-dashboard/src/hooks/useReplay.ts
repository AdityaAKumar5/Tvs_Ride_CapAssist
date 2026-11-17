import { useEffect } from 'react';
import { create } from 'zustand';

interface ReplayState {
  t: number;            // current time on the replay axis, seconds (fractional while playing)
  t0: number;           // start of the playable range
  t1: number;           // end of the playable range
  playing: boolean;
  speed: number;        // simulated seconds per real second
  revealAll: boolean;   // show boost outcomes before the replay reaches them (retrospective annotation)
  setRange: (t0: number, t1: number, keepTime?: boolean) => void;
  seek: (t: number) => void;
  step: (d: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  setSpeed: (s: number) => void;
  setRevealAll: (r: boolean) => void;
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export const useReplay = create<ReplayState>((set, get) => ({
  t: 1, t0: 1, t1: 600, playing: false, speed: 5, revealAll: false,
  setRange: (t0, t1, keepTime) => {
    const s = get();
    if (s.t0 === t0 && s.t1 === t1) return;
    set({ t0, t1, t: keepTime ? clamp(s.t, t0, t1) : t0, playing: keepTime ? s.playing : false });
  },
  seek: (t) => set((s) => ({ t: clamp(t, s.t0, s.t1) })),
  step: (d) => set((s) => ({ t: clamp(Math.round(s.t) + d, s.t0, s.t1), playing: false })),
  play: () => set((s) => ({ playing: true, t: s.t >= s.t1 ? s.t0 : s.t })),
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  restart: () => set((s) => ({ t: s.t0 })),
  setSpeed: (speed) => set({ speed }),
  setRevealAll: (revealAll) => set({ revealAll }),
}));

/** One animation loop for the whole app. Mounted once in App. */
export function useReplayLoop(): void {
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = useReplay.getState();
      if (s.playing) {
        const t = s.t + dt * s.speed;
        if (t >= s.t1) useReplay.setState({ t: s.t1, playing: false });
        else useReplay.setState({ t });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** The current whole second. Components that show values re-render once per simulated second, not per frame. */
export function useReplaySecond(): number {
  return useReplay((s) => Math.round(s.t));
}

/** Set the playable range when a page or scenario changes. */
export function useReplayRange(t0: number, t1: number): void {
  const setRange = useReplay((s) => s.setRange);
  useEffect(() => { setRange(t0, t1); }, [t0, t1, setRange]);
}
