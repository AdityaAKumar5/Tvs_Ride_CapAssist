import { GLOSSARY, STATUS_LABEL } from '../utils/glossary';
import { Modal, StatusBadge } from './ui';
import type { DataStatus } from '../types';

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Help and definitions" onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        {Object.entries(GLOSSARY).map(([k, g]) => (<div key={k}><b className="text-head">{g.title}</b><p className="text-muted">{g.text}</p></div>))}
      </div>
      <h3 className="h-tech uppercase mt-5 mb-2">Evidence labels</h3>
      <div className="grid md:grid-cols-2 gap-2 text-[13px]">
        {(Object.keys(STATUS_LABEL) as DataStatus[]).map((s) => (<div key={s} className="flex items-center gap-2"><StatusBadge status={s} />{STATUS_LABEL[s].long}</div>))}
      </div>
      <h3 className="h-tech uppercase mt-5 mb-2">Using the dashboard</h3>
      <ul className="list-disc pl-5 text-[13px] space-y-1 text-muted">
        <li>The operating-condition switch (Warm / Cold pass / Hot pass) decides which data set every page shows. Warm and cold results are never mixed without a label.</li>
        <li>In a replay, drag on any chart to scrub. Space plays or pauses; the arrow keys step one second.</li>
        <li>In presentation mode, the right and left arrow keys change step and Esc leaves.</li>
        <li>Every number comes from the simulation files. Nothing here is a measurement on a motorcycle.</li>
      </ul>
    </Modal>
  );
}
