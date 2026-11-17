import { useActiveScenario } from '../hooks/useScenario';
import { useReplayRange } from '../hooks/useReplay';
import { ReplayWorkbench } from '../components/ReplayWorkbench';
import { Btn, Chip, Notice, PageHead } from '../components/ui';
import { downloadCsv } from '../utils/export';
import { OUTCOME_LABEL } from '../styles/theme';
import { Download } from 'lucide-react';
import { availability } from '../utils/calc';

export default function Replay() {
  const sc = useActiveScenario();
  useReplayRange(sc?.range[0] ?? 1, sc?.range[1] ?? 600);
  if (!sc) return null;
  const a = availability(sc.summary.full, sc.summary.requests);
  const exportEvents = () => downloadCsv(`capassist_events_${sc.condition}_${sc.key}.csv`,
    [['scenario', 'condition', 'request_time_s', 'outcome_known_s', 'outcome', 'boost_energy_wh'],
      ...sc.events.map((e) => [sc.label, sc.condition, e.t, e.end, OUTCOME_LABEL[e.outcome], e.wh])]);
  return (
    <div>
      <PageHead title="Drive-Cycle Replay" subtitle="Second-by-second playback of the logged simulation: nothing on this page is animated by hand"
        right={<>
          <Chip>{sc.label}</Chip><Chip>{sc.conditionLabel}</Chip>
          <Chip>{a === null ? 'No electric assist' : `${sc.summary.full}/${sc.summary.requests} boosts in full`}</Chip>
          <Btn onClick={exportEvents} title="Export this scenario's boost events"><Download size={14} />Events CSV</Btn>
        </>} />
      {sc.condition !== 'warm' && <div className="mb-3"><Notice>You are replaying the <b>{sc.condition} pass</b> of a cold-start run (seconds {sc.range[0]}–{sc.range[1]} from engine start). The continuous cold-then-hot sequence is on the Cold Start & Parking page.</Notice></div>}
      <ReplayWorkbench sc={sc} range={sc.range} showTemp={sc.condition !== 'warm'} />
    </div>
  );
}
