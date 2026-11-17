# CapAssist | Hybrid Energy Intelligence

Interactive engineering dashboard for the CapAssist concept (TVS RiDE Ideathon): an ultracapacitor
bank added to a mild-hybrid motorcycle so that short, repeated torque-assist bursts do not have to
come from the 12 V lead-acid battery.

**Engineering Concept Demonstrator — Not Production Validated.** Every number in the dashboard is a
simulation output or a stated assumption. Nothing is a measurement on a motorcycle. The project is
not affiliated with or endorsed by TVS Motor Company; the colour palette is an original design, not
an official corporate specification.

## Run it

Requires Node.js 18 or later.

```
npm install
npm run dev
```

Then open the address Vite prints (normally http://localhost:5173). After `npm install` the app
works offline: fonts and data are bundled, nothing is fetched from the internet.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the verification tests against the bundled data |
| `npm run build` | Type-checks and builds a static site into `dist/` |
| `npm run preview` | Serves the built site |

The built site must be served by a web server (`npm run preview` or any static host). Opening
`dist/index.html` directly from disk will not load the data files.

## Pages

1. **Overview** – KPI cards, boost availability by system, 12 V battery pulse duty.
2. **Drive-Cycle Replay** – second-by-second replay of the logged simulation with instruments,
   inferred operating state, boost events and six synchronized signal strips.
3. **Mode Comparison** – any two scenarios side by side, Eco against Power, stress cases, the
   high-power lithium alternative, and a dual-simulation view on one shared cursor.
4. **Cold Start & Parking** – engine and ultracapacitor readiness, key-on pre-charge sequence, the
   continuous 20-minute cold-then-hot replay, battery energy breakdown and the sensitivity lab.
5. **Energy Management** – animated architecture for Option X and Option Y in 13 operating states,
   and the ultracapacitor engineering lab.
6. **Engineering Validation** – what is demonstrated, what is unproven, alternatives, cost, model
   assumptions, and live verification tests on whatever data is loaded.

Also: Presentation Mode (8 guided steps; arrow keys change step, Esc leaves), Data Import, Help and
definitions, light and dark themes, bookmarks, CSV and chart image export.

Keyboard: Space plays or pauses a replay; the left and right arrows step one second.

The **Warm / Cold pass / Hot pass** switch in the header decides which data set every page shows.
Warm and cold results are never mixed without a label.

## Data

All data lives in `public/data` and is read at start-up.

| File | Contents |
|---|---|
| `dashboard_timeseries.csv` | Warm package: 12 scenarios × 600 s |
| `boost_events.csv` | Warm boost requests and outcomes |
| `scenario_metadata.json` | Warm scenario descriptions and summaries |
| `results.csv` | Warm summary table (the authority for warm summary numbers) |
| `cold_replay_timeseries.csv` | Cold package: 17 scenarios × 1200 s (cold pass, then hot pass) |
| `cold_boost_events.csv` | Cold-package boost requests and outcomes |
| `cold_scenario_metadata.json` | Cold scenario descriptions, parking and key-on totals, both pass summaries |
| `results_cold.csv` | Cold summary table |
| `warm_sensitivity.csv` | Precomputed warm stress cases |

Rules the loader follows:

- `-`, blank cells and `null` are **missing**, never zero.
- With no boost requests, availability is **N/A**, not 0%.
- `generator_electrical_w` (warm) and `generator_total_electrical_w` (cold) are total generator
  output, not regeneration only. Regeneration appears only as a per-scenario total.
- Cold observations are keyed by `case_key + phase + time_s`; `elapsed_from_engine_start_s` is the
  replay axis.
- A boost outcome is known only when the boost ends (`end_time_s`). The replay colours a marker
  only then, unless "show all outcomes" is ticked.
- Source priority when results conflict: cold package outputs, then its metadata, then the warm
  package, then the design specification.

### Regenerating the data

The data is produced by the Python model in `simulation/` (no third-party packages needed):

```
cd simulation
python3 export_dashboard_data.py ../public/data
```

To try new parameters, change them in `sim.py` or add a case to `export_dashboard_data.py`, run the
export, and reload the dashboard. Files can also be replaced at run time through **Data Import**;
a file with missing columns is refused and the current data stays in place.

## What the dashboard does not claim

- Significant fuel savings over stock iGO Assist (the modelled difference is well under 1%).
- That the existing 12 V battery can be removed.
- Any improvement in battery lifetime (not tested).
- That a high-power lithium 12 V battery is inferior (it matches CapAssist Eco in this model).
- Regeneration above the generator's 160 W rating (the 430 W case is an unconfirmed stretch case).
- That the pre-charge electronics or the fault fallback have been built or validated.

## Known limitations

- **Power mode and stop-start.** The design specification turns stop-start off in Power mode; the
  current simulation case for Power still has it on. Its fuel and engine-off figures are therefore
  optimistic. The dashboard says so wherever it matters. Boost counts are not affected.
- Eco uses a shorter boost than stock and Power, so 10/10 against 6/9 is not a hardware-only
  comparison. The dashboard warns about this next to every such comparison.
- Engine temperature, capacitor leakage and battery charge acceptance are assumptions.
- Lead-acid self-discharge while parked is not modelled.
- The key-on sequence before engine start (5 s) is not in the time series; it is shown from
  scenario metadata as a modelled process, without a waveform.
- Engine RPM, cell voltages, battery current and motor temperature are not logged and are shown
  as not available.
- The "CapAssist Y Eco, one-boost reserve" scenario is a superseded design kept for reference.

## Project structure

```
public/data/          simulation output read by the app
simulation/           Python model and the export script
src/types/            typed interfaces for warm and cold data
src/data/             schemas, CSV/JSON parsing, bundle builder, loader
src/utils/            calculations, scenario resolution, state inference, verification, export
src/hooks/            app state, replay engine, element size
src/charts/           time-series strip, dial gauge, summary charts
src/visualizations/   architecture diagram, readiness, key-on sequence, boost profile, capacitor lab
src/components/       header, replay controls and workbench, dual view, dialogs, presentation mode
src/pages/            the six pages
src/styles/           theme tokens and global styles
tests/                verification tests
```

## Verification

`npm test` checks, among other things: the warm results (stock 4/9, 6/9, 7/9; CapAssist Eco 10/10;
Power 9/9; lithium 10/10), the cold results (Eco 9/10 overnight, one week and one month; Power 8/9
after one month), the sensitivity cases (2.5 A: 7/10; 10 A: 9/10; slow warm-up: 6/10; 15 °C: 7/10),
scenario and sample counts, the cold/hot boundary, event mapping, missing-value handling and the
ultracapacitor formulas. The same checks run in the browser on the Engineering Validation page.
