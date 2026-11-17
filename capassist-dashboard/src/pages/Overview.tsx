import { useRef } from 'react';
import { Download, ImageDown } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useActiveScenario } from '../hooks/useScenario';
import { AvailabilityChart, AvailabilityLegend } from '../charts/AvailabilityChart';
import { BatteryDutyChart } from '../charts/BatteryDutyChart';
import { Btn, Card, Chip, InfoTip, Kpi, Notice, PageHead, StatusBadge } from '../components/ui';
import { availability, fmt, fmtInt } from '../utils/calc';
import { availRows, dutyRows, entriesFor } from '../utils/rows';
import { downloadCsv, exportChart } from '../utils/export';
import { SIGNAL } from '../styles/theme';

export default function Overview() {
  const data = useApp((s) => s.data)!;
  const condition = useApp((s) => s.condition);
  const setScenario = useApp((s) => s.setScenario);
  const sc = useActiveScenario();
  const hero = useRef<HTMLDivElement>(null);
  if (!sc) return null;
  const m = sc.summary;
  const a = availability(m.full, m.requests);
  const noAssist = m.requests === 0;
  const isLi = sc.meta.family === 'lithium';

  const exportTable = () => {
    const head = ['scenario', 'condition', 'boost_requests', 'full', 'cut_short', 'denied', 'engine_cold', 'availability_pct', 'regen_wh',
      'battery_out_wh', 'battery_pulses', 'fuel_ml', 'km_per_l', 'engine_off_s', 'uc_vmin', 'uc_vmax'];
    const rows = entriesFor(data, condition, true).map((e) => { const s = e.summary; const av = availability(s.full, s.requests);
      return [e.name, condition, s.requests, s.full, s.cutShort, s.denied, s.engineCold, av === null ? null : Number(av.toFixed(1)), s.regenWh,
        s.batteryOutWh, s.batteryPulses, s.fuelMl, s.kmPerL, s.engineOffS, s.ucVmin, s.ucVmax]; });
    downloadCsv(`capassist_overview_${condition}.csv`, [head, ...rows]);
  };

  return (
    <div>
      <PageHead title="CapAssist Performance Overview" subtitle="Electric torque-assist availability and energy management under urban driving conditions"
        right={<>
          <Btn onClick={exportTable} title="Export the summary of every scenario in this condition"><Download size={14} />CSV</Btn>
          <Btn onClick={() => exportChart(hero.current, `capassist_availability_${condition}`, 'png')} title="Save the availability chart as PNG"><ImageDown size={14} />PNG</Btn>
          <Btn onClick={() => exportChart(hero.current, `capassist_availability_${condition}`, 'svg')} title="Save the availability chart as SVG"><ImageDown size={14} />SVG</Btn>
        </>} />

      <div className="flex flex-wrap gap-2 mb-4">
        <Chip>TVS Raider 125 reference vehicle <StatusBadge status="spec" /></Chip>
        <Chip>WMTC Part 1, reduced speed</Chip>
        <Chip>{data.warm.info.duration} s cycle</Chip>
        <Chip>{(data.warm.info.distanceM / 1000).toFixed(2)} km per cycle</Chip>
        <Chip color={condition === 'warm' ? SIGNAL.full : condition === 'cold' ? SIGNAL.cold : SIGNAL.temp}>{sc.conditionLabel}</Chip>
        <Chip>{data.warm.info.model}</Chip>
        <Chip color="#E11B22">Simulation-only evidence</Chip>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Selected:</span><b className="text-head">{sc.label}</b>
        {sc.meta.mode && <Chip>{sc.meta.mode} mode</Chip>}
        {sc.meta.boost_profile && <Chip>{sc.meta.boost_profile === 'tapered_3s_1s' ? 'Tapered boost: 3 s + 1 s fade' : 'Sustained boost: up to 8 s'}</Chip>}
        {sc.meta.architecture && <Chip>Option {sc.meta.architecture}</Chip>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
        <Kpi label="Boost availability" tip="availability" value={a === null ? 'N/A' : a.toFixed(0)} unit={a === null ? '' : '%'} accent={SIGNAL.full}
          sub={noAssist ? 'No electric assist on this vehicle' : `${m.full} of ${m.requests} requests`} />
        <Kpi label="Boosts delivered" value={noAssist ? 'N/A' : `${m.full}/${m.requests}`} accent={SIGNAL.full}
          sub={noAssist ? 'No boost requests' : 'full / requested'} />
        <Kpi label="Regenerative energy" tip="regen" value={fmt(m.regenWh, 2)} unit="Wh" accent={SIGNAL.regen} sub="generated while fuel is cut" />
        <Kpi label="12 V battery output" tip="pulse" value={isLi ? 'N/A' : fmt(m.batteryOutWh, 2)} unit={isLi ? '' : 'Wh'} accent={SIGNAL.lead}
          sub={isLi ? 'The lithium battery is the store' : `${fmtInt(m.batteryPulses)} high-current pulse${m.batteryPulses === 1 ? '' : 's'}`} />
        <Kpi label="Fuel economy" value={fmt(m.kmPerL, 1)} unit="km/L" accent={SIGNAL.fuel} sub={`${fmt(m.fuelMl, 1)} mL in the cycle · not calibrated`} />
        <Kpi label="Engine-off time" value={fmtInt(m.engineOffS)} unit="s" accent={SIGNAL.inactive} sub="of 600 s, by stop-start" />
      </div>

      {!noAssist && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip color={SIGNAL.denied}>Denied by energy store: <b className="num">{m.denied}</b></Chip>
          <Chip color={SIGNAL.partial}>Cut short: <b className="num">{m.cutShort}</b></Chip>
          {condition !== 'warm' && <Chip color={SIGNAL.cold}>Refused, engine cold: <b className="num">{m.engineCold}</b></Chip>}
          <Chip color={SIGNAL.lead}>Battery pulses: <b className="num">{fmtInt(m.batteryPulses)}</b></Chip>
          {sc.hasBank && <Chip color={SIGNAL.uc}>Bank voltage: <b className="num">{fmt(m.ucVmin, 1)}–{fmt(m.ucVmax, 1)} V</b> <InfoTip term="reserve" /></Chip>}
        </div>
      )}

      <div className="mb-4 rounded-xl border-l-4 border-racing bg-panel border border-line shadow-card px-4 py-3">
        <p className="h-tech text-[17px] leading-snug">CapAssist's main modelled benefit is more consistent availability of electric torque assistance, not substantial fuel savings.</p>
        <p className="text-xs text-muted mt-1">Fuel economy differs from stock iGO Assist by well under 1% in this model. A high-power lithium 12 V battery matches CapAssist Eco on boost availability. Both are shown, not hidden.</p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title={<>Electric torque-assist availability by system <InfoTip term="availability" /></>} right={<><AvailabilityLegend /><StatusBadge status="sim" /></>}>
          <div ref={hero}><AvailabilityChart rows={availRows(data, condition, sc.key)} onSelect={setScenario} /></div>
          <div className="mt-2"><Notice tone="warn"><b>Boost profiles are not identical.</b> Eco uses a shorter, lower-energy boost (3 s + 1 s fade) than stock or Power (up to 8 s). 10/10 against 6/9 is therefore not a hardware-only comparison: a matched request schedule is needed to isolate the storage hardware.</Notice></div>
          <p className="text-xs text-muted mt-2">Click a system name to select it. {condition !== 'warm' && 'Sensitivity cases are on the Cold Start & Parking page.'}</p>
        </Card>
        <Card className="col-span-12 xl:col-span-5" title={<>12 V battery pulse duty <InfoTip term="pulse" /></>} right={<StatusBadge status="sim" />}>
          <BatteryDutyChart rows={dutyRows(data, condition)} />
          <ul className="text-xs text-muted mt-2 space-y-1 list-disc pl-4">
            <li><b className="text-ink">Boost and restart pulses</b> are the high-current events, up to about 35 A in the model. Stock iGO Assist takes all of them from the 12 V battery.</li>
            <li><b className="text-ink">Engine-off electrical loads</b> are a slow drain of about 3 A. With CapAssist this is all the battery supplies while riding <InfoTip term="handover" />.</li>
            <li><b className="text-ink">First engine start</b> after parking is always a battery pulse{sc.cold ? `: ${fmt(sc.cold.first_start_pulse_wh, 2)} Wh in the model` : ''}. It appears in the cold pass only.</li>
          </ul>
          <p className="text-[11px] text-muted mt-2">Energy totals do not show battery current or battery wear. Battery life has not been tested.</p>
        </Card>
      </div>
    </div>
  );
}
