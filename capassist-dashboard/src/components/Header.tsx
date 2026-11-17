import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bookmark, HelpCircle, Moon, MonitorPlay, Sun, Upload, X } from 'lucide-react';
import type { Condition } from '../types';
import { useApp } from '../hooks/useApp';
import { ScenarioSelect } from './ScenarioSelect';
import { Chip, Segmented } from './ui';

export const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/replay', label: 'Drive-Cycle Replay' },
  { to: '/compare', label: 'Mode Comparison' },
  { to: '/cold', label: 'Cold Start & Parking' },
  { to: '/energy', label: 'Energy Management' },
  { to: '/validation', label: 'Engineering Validation' },
];

const CONDITIONS: { value: Condition; label: string; title: string }[] = [
  { value: 'warm', label: 'Warm', title: 'Warm steady state: 12 scenarios, engine warm, store in balance' },
  { value: 'cold', label: 'Cold pass', title: 'First 600 s after a cold start: 17 scenarios' },
  { value: 'hot', label: 'Hot pass', title: 'The 600 s that follow the cold pass: 17 scenarios' },
];

export function Header({ onImport, onHelp }: { onImport: () => void; onHelp: () => void }) {
  const { condition, setCondition, theme, toggleTheme, setPresenting, data, bookmarks, addBookmark, applyBookmark, removeBookmark } = useApp();
  const [bmOpen, setBmOpen] = useState(false);
  const [name, setName] = useState('');
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="bg-navy text-white">
        <div className="max-w-[1500px] mx-auto px-5 h-[52px] flex items-center gap-5">
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="font-tech font-bold text-[22px] tracking-[0.14em]">CAP<span className="text-racing">ASSIST</span></span>
            <span className="hidden 2xl:inline text-[11px] tracking-[0.2em] text-white/60 font-tech">HYBRID ENERGY INTELLIGENCE</span>
          </div>
          <nav className="flex-1 flex items-center justify-center gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => `px-3 py-1.5 rounded-md font-tech text-[14px] tracking-wide whitespace-nowrap border-b-2 ${
                  isActive ? 'bg-white/10 border-racing text-white' : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setPresenting(true)} className="flex items-center gap-1.5 bg-racing hover:brightness-110 rounded-md px-2.5 py-1.5 text-[13px] font-medium" title="Guided presentation for the jury">
              <MonitorPlay size={15} />Present
            </button>
            <IconBtn title="Bookmarks" onClick={() => setBmOpen((o) => !o)}><Bookmark size={16} /></IconBtn>
            <IconBtn title="Data import" onClick={onImport}><Upload size={16} /></IconBtn>
            <IconBtn title="Help and definitions" onClick={onHelp}><HelpCircle size={16} /></IconBtn>
            <IconBtn title={theme === 'light' ? 'Dark telemetry mode' : 'Light engineering mode'} onClick={toggleTheme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</IconBtn>
          </div>
        </div>
      </div>
      <div className="bg-panel border-b border-line shadow-sm">
        <div className="max-w-[1500px] mx-auto px-5 h-[44px] flex items-center gap-4">
          <span className="text-xs text-muted">Operating condition</span>
          <Segmented value={condition} options={CONDITIONS} onChange={setCondition} size="sm" />
          <ScenarioSelect />
          <div className="flex-1" />
          <Chip color="#E11B22">Simulation only · not production validated</Chip>
          <span className="hidden lg:inline text-xs text-muted num">{data?.warm.info.model}</span>
        </div>
      </div>
      {bmOpen && (
        <div className="absolute right-6 top-[54px] w-80 bg-panel border border-line rounded-xl shadow-card p-3 text-ink z-50">
          <div className="flex items-center justify-between mb-2"><b className="h-tech uppercase text-sm">Bookmarks (this session)</b>
            <button onClick={() => setBmOpen(false)} aria-label="Close"><X size={15} /></button></div>
          <div className="flex gap-2 mb-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this selection" className="flex-1 border border-line rounded px-2 py-1 text-[13px] bg-panel" />
            <button disabled={!name.trim()} onClick={() => { addBookmark(name.trim()); setName(''); }} className="bg-navy text-white rounded px-2 text-[13px] disabled:opacity-40">Save</button>
          </div>
          {bookmarks.length === 0 && <p className="text-xs text-muted">Nothing saved yet. A bookmark keeps the condition, the scenario and both comparison selections.</p>}
          {bookmarks.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-2 text-[13px] border-t border-line py-1.5">
              <button className="text-left hover:text-electric flex-1" onClick={() => { applyBookmark(b); setBmOpen(false); }}>{b.name}
                <span className="block text-[11px] text-muted">{b.condition} · {b.condition === 'warm' ? b.warmId : b.coldKey}</span></button>
              <button onClick={() => removeBookmark(b.name)} className="text-muted hover:text-racing" aria-label={`Delete ${b.name}`}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} aria-label={title} className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10">{children}</button>;
}
