import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useApp } from './hooks/useApp';
import { useReplay, useReplayLoop } from './hooks/useReplay';
import { Header } from './components/Header';
import { DataImport } from './components/DataImport';
import { Help } from './components/Help';
import { Presentation } from './components/Presentation';
import Overview from './pages/Overview';
import Replay from './pages/Replay';
import Compare from './pages/Compare';
import ColdStart from './pages/ColdStart';
import Energy from './pages/Energy';
import Validation from './pages/Validation';

export default function App() {
  const { status, error, load, presenting } = useApp();
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useReplayLoop();
  useEffect(() => { void load(); }, [load]);

  // Space plays or pauses; the arrow keys step one second (outside presentation mode and form fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); useReplay.getState().toggle(); }
      if (useApp.getState().presenting) return;
      if (e.key === 'ArrowRight') useReplay.getState().step(1);
      if (e.key === 'ArrowLeft') useReplay.getState().step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') {
    return <div className="h-full flex flex-col items-center justify-center gap-3"><div className="w-10 h-10 rounded-full border-4 border-line border-t-racing animate-spin" />
      <p className="h-tech text-lg">Loading simulation data…</p></div>;
  }
  if (status === 'error') {
    return <div className="h-full flex items-center justify-center p-8"><div className="max-w-xl bg-panel border border-racing/40 rounded-xl p-6">
      <h1 className="h-tech text-2xl text-racing mb-2">The simulation data could not be loaded</h1><p className="text-[13px] mb-2">{error}</p>
      <p className="text-[13px] text-muted">Check that the CSV and JSON files are in <code>public/data</code>, then reload. The README lists the files and their columns.</p></div></div>;
  }
  return (
    <HashRouter>
      <Header onImport={() => setImportOpen(true)} onHelp={() => setHelpOpen(true)} />
      <main className="max-w-[1500px] mx-auto px-5 pt-[116px] pb-10">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/cold" element={<ColdStart />} />
          <Route path="/energy" element={<Energy />} />
          <Route path="/validation" element={<Validation />} />
          <Route path="*" element={<Overview />} />
        </Routes>
        <footer className="mt-8 pt-3 border-t border-line text-xs text-muted flex flex-wrap justify-between gap-2">
          <span><b className="text-head">Engineering Concept Demonstrator — Not Production Validated.</b> TVS RiDE Ideathon. Not affiliated with or endorsed by TVS Motor Company.</span>
          <span>Every figure is a simulation output or a stated assumption. No physical measurements.</span>
        </footer>
      </main>
      {importOpen && <DataImport onClose={() => setImportOpen(false)} />}
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
      {presenting && <Presentation />}
    </HashRouter>
  );
}
