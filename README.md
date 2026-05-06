# Remote Control — SBR Aeration Prototype

Prototype for remote control of plant equipment, focused on the SBR Aeration group of the Adani Mumbai layout.

## Run locally
Open `index.html` in any modern browser, or serve the folder:
```
npx serve .
```

## Deploy to GitHub Pages
1. `git remote add origin https://github.com/<you>/RemoteControlNotAtAllOfficial.git`
2. `git push -u origin main`
3. In repo settings → Pages → Source: `main` / root.

## Features in this prototype
- **Group highlight** — dashed boundary around the SBR Aeration section, with a label badge.
- **Master Remote toggle** (top-right) — opens a confirmation modal listing every device that will be taken over (main + nested tank devices), plus a duration selector (5 min → 4 hr, or indefinite).
- **Per-equipment toggles** — disabled while in LOCAL; once REMOTE, each device can be flipped ON/OFF.
- **Interlocks** (refuses the toggle, shows red inline reason):
  - SBR Blowers cannot turn ON if both `AIR-1` and `AIR-2` air-line valves are closed.
  - SBR Blowers cannot turn ON while the Decanter is ON (regardless of air valves).
  - SBR-1 Inlet Valve cannot turn ON while the Decanter is ON.
- **Tank drill-down** — `Zone-3 CASS Basin 1` and `Basin 2` are clickable; a side drawer reveals the pumps inside (Re-Circulation A1/A2/B1/B2, Sludge Sump A1/A2/B1/B2). Tanks carry a pulsing "⊕ N inside · click to open" chip so the affordance is unmistakable.
- **Timer chip** — visible countdown, auto-release returns everything to PLC (LOCAL).
- **Manual release** — turning master switch OFF prompts a confirm dialog before releasing.
- **Mode pill** on every device shows LOCAL or REMOTE at all times.

## Files
- `index.html` — markup for the SBR section, master switch, modal, drawer, toast.
- `style.css` — styles incl. the dashed group border, tank water animation, chip pulse.
- `app.js` — device model, interlock rules, remote-control state machine, timer, drawer.

## Not yet wired
- The full plant overview (image 1) — the prototype demonstrates the full UX on the SBR group only. The same group/tank/interlock primitives generalize to the other sections.
- Real PLC backend — toggles are simulated locally.
- Permission/auth — there is no operator login.
