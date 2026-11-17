import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { ALL_FILES } from '../data/schemas';
import { validateFile } from '../data/parse';
import { Modal, Notice } from './ui';

/** Replace data files with uploaded ones. Each file is checked against its schema before anything changes. */
export function DataImport({ onClose }: { onClose: () => void }) {
  const { raw, imported, replaceFiles, data } = useApp();
  const [log, setLog] = useState<{ name: string; ok: boolean; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const good: Record<string, string> = {}; const entries: typeof log = [];
    for (const f of Array.from(list)) {
      if (!ALL_FILES.includes(f.name)) { entries.push({ name: f.name, ok: false, message: 'Not one of the expected file names' }); continue; }
      const text = await f.text();
      const v = validateFile(f.name, text);
      entries.push({ name: f.name, ok: v.ok, message: v.message });
      if (v.ok) good[f.name] = text;
    }
    setLog(entries);
    if (Object.keys(good).length) setError(replaceFiles(good));
  };

  return (
    <Modal title="Data import" onClose={onClose} wide>
      <p className="text-[13px] mb-3">The dashboard reads these files from <code>public/data</code>. To use newer simulation output, choose files with the same names. A file with missing columns is refused and the current data stays in place.</p>
      <label className="block border-2 border-dashed border-line rounded-lg p-5 text-center cursor-pointer hover:border-electric mb-3">
        <input type="file" multiple accept=".csv,.json" className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <span className="text-[13px]">Choose CSV / JSON files to replace the loaded data</span>
      </label>
      {error && <div className="mb-3"><Notice tone="red"><b>Import refused:</b> {error}</Notice></div>}
      {log.length > 0 && (
        <ul className="mb-3 space-y-1 text-[13px]">
          {log.map((l) => <li key={l.name} className="flex items-center gap-2">{l.ok ? <CheckCircle2 size={15} className="text-ok" /> : <XCircle size={15} className="text-denied" />}<code>{l.name}</code><span className="text-muted">{l.message}</span></li>)}
        </ul>
      )}
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-muted border-b border-line"><th className="py-1">File</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>
          {ALL_FILES.map((name) => {
            const v = raw[name] ? validateFile(name, raw[name]) : { ok: false, message: 'not loaded' };
            return (
              <tr key={name} className="border-b border-line/60">
                <td className="py-1"><code>{name}</code></td>
                <td className={v.ok ? 'text-ok' : 'text-denied'}>{v.message}</td>
                <td className="text-muted">{imported.includes(name) ? 'imported this session' : 'bundled with the app'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data && <p className="text-xs text-muted mt-3 num">Loaded: {data.counts.warmScenarios} warm scenarios ({data.counts.warmSamples.toLocaleString()} samples), {data.counts.coldScenarios} cold scenarios ({data.counts.coldSamples.toLocaleString()} samples).</p>}
      <p className="text-xs text-muted mt-2">Source priority when results conflict: cold-start package, then its metadata, then the warm replay package, then the design specification. Older design logs are for history only.</p>
    </Modal>
  );
}
