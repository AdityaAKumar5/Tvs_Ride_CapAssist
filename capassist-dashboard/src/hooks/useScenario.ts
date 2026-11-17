import { useMemo } from 'react';
import type { ActiveScenario } from '../types';
import { useApp } from './useApp';
import { parseSel, resolveScenario } from '../utils/scenario';

/** The globally selected scenario for the current operating condition. */
export function useActiveScenario(): ActiveScenario | null {
  const data = useApp((s) => s.data);
  const condition = useApp((s) => s.condition);
  const warmId = useApp((s) => s.warmId);
  const coldKey = useApp((s) => s.coldKey);
  return useMemo(() => (data ? resolveScenario(data, condition, condition === 'warm' ? warmId : coldKey) : null),
    [data, condition, warmId, coldKey]);
}

/** A scenario from a selection string such as "warm:B2" or "cold:D_park_12h". */
export function useSelScenario(sel: string): ActiveScenario | null {
  const data = useApp((s) => s.data);
  return useMemo(() => {
    if (!data) return null;
    const { condition, key } = parseSel(sel);
    return resolveScenario(data, condition, key);
  }, [data, sel]);
}
