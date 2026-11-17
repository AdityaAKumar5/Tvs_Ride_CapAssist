import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { DataStatus } from '../types';
import { GLOSSARY, STATUS_LABEL } from '../utils/glossary';

export function Card({ title, right, children, className = '', pad = true }:
  { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`bg-panel border border-line rounded-xl shadow-card ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-line/70">
          <h3 className="h-tech text-[15px] uppercase tracking-wide flex items-center gap-2">{title}</h3>
          <div className="flex items-center gap-2 text-xs">{right}</div>
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

/** Says what kind of evidence a number is: simulation, estimate, specification or assumption. */
export function StatusBadge({ status }: { status: DataStatus }) {
  const s = STATUS_LABEL[status];
  return <span title={s.long} className={`inline-block border rounded px-1.5 py-[1px] text-[10px] font-semibold tracking-wide ${s.cls}`}>{s.short}</span>;
}

/** Small "i" that explains a measurement on hover or focus. */
export function InfoTip({ term }: { term: keyof typeof GLOSSARY | string }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[term];
  if (!g) return null;
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={`What is ${g.title}?`} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="text-muted hover:text-electric"><Info size={13} /></button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-1/2 -translate-x-1/2 top-5 w-64 rounded-lg border border-line bg-panel shadow-card p-3 text-xs text-ink normal-case tracking-normal font-normal font-sans">
          <b className="block mb-1 text-head">{g.title}</b>{g.text}
        </span>
      )}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }:
  { value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-soft p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} title={o.title} onClick={() => onChange(o.value)}
          className={`${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-[13px]'} rounded-md font-medium transition-colors ${
            value === o.value ? 'bg-navy dark:bg-electric text-white shadow' : 'text-muted hover:text-ink'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, children, label, className = '' }:
  { value: string; onChange: (v: string) => void; children: ReactNode; label?: string; className?: string }) {
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {label && <span className="whitespace-nowrap">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-panel text-ink border border-line rounded-md px-2 py-1 text-[13px] max-w-[340px] focus:outline-none focus:ring-2 focus:ring-electric/40">
        {children}
      </select>
    </label>
  );
}

export function Btn({ children, onClick, title, active, variant = 'ghost', disabled }:
  { children: ReactNode; onClick?: () => void; title?: string; active?: boolean; variant?: 'ghost' | 'solid' | 'red'; disabled?: boolean }) {
  const cls = variant === 'solid' ? 'bg-navy dark:bg-electric text-white hover:bg-blue border-navy'
    : variant === 'red' ? 'bg-racing text-white hover:brightness-110 border-racing'
    : `bg-panel text-ink hover:bg-soft border-line ${active ? 'ring-2 ring-electric/50' : ''}`;
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className={`inline-flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-[13px] font-medium transition disabled:opacity-40 ${cls}`}>{children}</button>
  );
}

export function Kpi({ label, value, unit, sub, status = 'sim', accent, tip }:
  { label: string; value: string; unit?: string; sub?: ReactNode; status?: DataStatus; accent?: string; tip?: string }) {
  return (
    <div className="relative bg-panel border border-line rounded-xl shadow-card px-4 py-3 overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent ?? '#0B3A83' }} />
      <div className="flex items-center justify-between gap-2">
        <span className="h-tech text-[12px] uppercase tracking-wider text-muted flex items-center gap-1">{label}{tip && <InfoTip term={tip} />}</span>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="h-tech num text-[34px] leading-none">{value}</span>
        {unit && <span className="text-muted text-sm">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted num">{sub}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'red'; children: ReactNode }) {
  const cls = tone === 'warn' ? 'border-regen/50 bg-regen/10' : tone === 'red' ? 'border-racing/40 bg-racing/5' : 'border-electric/30 bg-electric/5';
  return <div className={`rounded-lg border px-3 py-2 text-[13px] ${cls}`}>{children}</div>;
}

export function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-2.5 py-0.5 text-xs text-ink whitespace-nowrap">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{children}
    </span>
  );
}

export function PageHead({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="h-tech text-[28px] leading-tight">{title}</h1>
        <p className="text-muted text-[13px] italic">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] bg-navy/60 backdrop-blur-sm flex items-start justify-center p-6 overflow-auto" onClick={onClose}>
      <div className={`bg-panel border border-line rounded-xl shadow-card w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} mt-10`} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="h-tech text-lg uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-racing text-sm border border-line rounded px-2 py-0.5">Close</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
