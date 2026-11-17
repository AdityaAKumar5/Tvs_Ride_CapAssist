import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { ActiveScenario } from '../types';
import { useReplay, useReplaySecond } from '../hooks/useReplay';
import { Btn } from './ui';

const SPEEDS = [0.5, 1, 2, 5, 10];

/** Times worth jumping to: boost requests and the moments the engine stops. */
export function navPoints(sc: ActiveScenario | null, t0: number, t1: number): number[] {
  if (!sc) return [];
  const pts = new Set<number>();
  for (const e of sc.events) if (e.t >= t0 && e.t <= t1) pts.add(e.t);
  const s = sc.series;
  for (let i = 1; i < s.n; i++) if (s.engineOn[i] === 0 && s.engineOn[i - 1] === 1 && s.t[i] >= t0 && s.t[i] <= t1) pts.add(s.t[i]);
  return [...pts].sort((a, b) => a - b);
}

export function ReplayControls({ scenario, compact }: { scenario: ActiveScenario | null; compact?: boolean }) {
  const sec = useReplaySecond();
  const { t0, t1, playing, speed } = useReplay();
  const { toggle, restart, step, seek, setSpeed } = useReplay.getState();
  const pts = useMemo(() => navPoints(scenario, t0, t1), [scenario, t0, t1]);
  const prev = () => { const p = [...pts].reverse().find((x) => x < sec - 0.5); useReplay.setState({ playing: false }); seek(p ?? t0); };
  const next = () => { const p = pts.find((x) => x > sec + 0.5); useReplay.setState({ playing: false }); seek(p ?? t1); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn variant="red" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}</Btn>
      <Btn onClick={restart} title="Restart from the beginning of the range"><RotateCcw size={14} />{!compact && 'Restart'}</Btn>
      <Btn onClick={prev} title="Previous event (boost request or engine stop)"><SkipBack size={14} />{!compact && 'Prev event'}</Btn>
      <Btn onClick={() => step(-1)} title="Step back one second"><ChevronLeft size={14} />1 s</Btn>
      <Btn onClick={() => step(1)} title="Step forward one second">1 s<ChevronRight size={14} /></Btn>
      <Btn onClick={next} title="Next event (boost request or engine stop)">{!compact && 'Next event'}<SkipForward size={14} /></Btn>
      <input type="range" min={t0} max={t1} step={1} value={sec} aria-label="Seek" onChange={(e) => seek(Number(e.target.value))}
        className="flex-1 min-w-[160px]" />
      <span className="num text-[13px] w-[92px] text-right"><b>{sec}</b> / {t1} s</span>
      <div className="inline-flex rounded-md border border-line overflow-hidden" title="Playback speed: simulated seconds per second">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)}
            className={`px-2 py-1 text-xs num ${speed === s ? 'bg-navy dark:bg-electric text-white' : 'bg-panel text-muted hover:text-ink'}`}>{s}×</button>
        ))}
      </div>
    </div>
  );
}
