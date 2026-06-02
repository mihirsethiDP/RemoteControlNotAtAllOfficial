/* eslint-disable */
// Generates docs/PRD.docx from inline content.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  LevelFormat, PageOrientation, PageNumber, Header, Footer,
} = require("docx");

const BRAND = "193458";
const TEXT  = "1a2333";
const MUTE  = "5b6878";
const RULE  = "d6dde7";
const SOFT  = "f4f6fa";

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: 300 },
    alignment: opts.alignment ?? AlignmentType.LEFT,
    children: [new TextRun({ text, font: "Calibri", size: opts.size ?? 22, color: opts.color ?? TEXT, bold: opts.bold, italics: opts.italics })],
  });

const H1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, font: "Calibri", size: 36, bold: true, color: BRAND })],
  });

const H2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, font: "Calibri", size: 28, bold: true, color: BRAND })],
  });

const H3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 24, bold: true, color: TEXT })],
  });

const Bullet = (text, level = 0) =>
  new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 40, line: 280 },
    children: [new TextRun({ text, font: "Calibri", size: 22, color: TEXT })],
  });

// Mixed-format bullet: array of {text, bold?, italics?, color?}
const BulletRich = (segments, level = 0) =>
  new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 40, line: 280 },
    children: segments.map(s => new TextRun({ text: s.text, font: "Calibri", size: 22, color: s.color ?? TEXT, bold: s.bold, italics: s.italics })),
  });

const Code = (text) =>
  new Paragraph({
    spacing: { before: 60, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
    children: [new TextRun({ text, font: "Consolas", size: 20, color: BRAND })],
  });

const Quote = (text) =>
  new Paragraph({
    spacing: { before: 120, after: 120, line: 300 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 12 } },
    children: [new TextRun({ text, font: "Calibri", size: 22, color: MUTE, italics: true })],
  });

const SectionDivider = () =>
  new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
    children: [new TextRun("")],
  });

// ---- Tables ----
function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: BRAND, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, font: "Calibri", size: 20, bold: true, color: "FFFFFF" })],
    })],
  });
}
function bodyCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts.fill || "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: opts.alignment || AlignmentType.LEFT,
      children: [new TextRun({ text, font: "Calibri", size: 20, color: TEXT, bold: opts.bold })],
    })],
  });
}
function makeTable(headers, rows, widths) {
  const totalDxa = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalDxa, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => bodyCell(c, widths[i], { fill: ri % 2 ? "fbfcfe" : "ffffff" })),
      })),
    ],
  });
}

// ============================================================
// Content
// ============================================================
const children = [];

// Cover
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 120 },
    children: [new TextRun({ text: "PRODUCT REQUIREMENTS DOCUMENT", font: "Calibri", size: 22, bold: true, color: MUTE, characterSpacing: 80 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: "Remote Control — Set Point Configuration & Plant Layout", font: "Calibri", size: 48, bold: true, color: BRAND })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text: "Adani Mumbai · Sewage Treatment Plant", font: "Calibri", size: 26, color: TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 60 },
    children: [new TextRun({ text: "Author · Digital Paani Product team", font: "Calibri", size: 22, color: MUTE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: `Version 1.0 · ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, font: "Calibri", size: 22, color: MUTE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "Status · Draft for review", font: "Calibri", size: 22, color: MUTE, italics: true })],
  }),
  new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
);

// 1. Overview
children.push(H1("1.  Overview"));
children.push(P("This document captures the product requirements for three surfaces of the Remote Control software currently in pilot at Adani's Mumbai treatment plant:"));
children.push(Bullet("Set Point Configuration — the implementer-facing screen used during commissioning to create unit processes, associate equipment, and define the operator-adjustable thresholds (set points) that drive the plant's automation."));
children.push(Bullet("Plant Layout · Client View — the operator-facing visualisation of the plant. Read-only with edit-value affordances on each set point."));
children.push(Bullet("Plant Layout · Configuration Mode — the same plant visualisation, but with a toggle that surfaces the configuration interface in-context, so the implementer can configure the plant without leaving the layout view."));
children.push(P("The Studio (drag-arrange dashboard builder) and the standalone Operator Dashboard are explicitly out of scope for this document.", { italics: true, color: MUTE }));

// 1.1 Goals
children.push(H2("1.1  Goals"));
children.push(Bullet("Give plant implementers a single, simple workflow to bring a new plant online: create unit processes → associate equipment → add set points."));
children.push(Bullet("Give plant operators a calm, low-cognitive-load visualisation of live plant state and a one-tap path to adjust any operator-tunable threshold."));
children.push(Bullet("Keep operator and implementer views visually and behaviourally distinct. Configuration affordances must never appear in the client view."));
children.push(Bullet("Apply Hick's law, Doherty threshold and progressive disclosure so the screens are usable on the first day of training."));

// 1.2 Non-goals
children.push(H2("1.2  Non-goals"));
children.push(Bullet("PLC programming or tag mapping. The implementer types human-friendly metadata; PLC tags are auto-generated and handed to the controls team via a separate mapping table."));
children.push(Bullet("Operator authentication, role management, or audit-log review UI."));
children.push(Bullet("Mobile-first design. Both surfaces are tuned for desktop / wall-mount displays (≥1280×800)."));

// 1.3 Audiences
children.push(H2("1.3  Audiences"));
children.push(makeTable(
  ["Audience", "Surface(s)", "Frequency"],
  [
    ["Plant operator", "Plant Layout (Client View) only", "Continuous — 24×7"],
    ["Plant implementer / commissioning engineer", "Set Point Configuration · Plant Layout (Configuration Mode)", "During commissioning + occasional"],
    ["Maintenance / process engineer", "Plant Layout (both modes)", "On change request"],
  ],
  [2200, 4400, 2400],
));

children.push(SectionDivider());

// 2. Set Point Configuration
children.push(H1("2.  Set Point Configuration"));
children.push(P("The Set Point Configuration screen is the implementer's home base. It enforces the workflow that brings the plant online in three deliberate steps."));
children.push(Quote("Step 1 — create a unit process · Step 2 — associate equipment · Step 3 — add set points to it."));

children.push(H2("2.1  Information architecture"));
children.push(P("The screen is a vertical stack of collapsible Unit Process cards. Each card carries the full lifecycle of one unit process. No global table of set points exists on this screen — every set point belongs to exactly one unit process, and is created from inside its parent UP card."));

children.push(H3("Top bar"));
children.push(Bullet("Page title and three-step subtitle (above)."));
children.push(Bullet("Primary CTA: + Create unit process (top right)."));
children.push(Bullet("Search input that fuzzy-matches over unit process name, set point name, HMI tag, and equipment names."));
children.push(Bullet("Counter pill — “N unit processes · M set points.”"));

children.push(H3("Unit Process card — collapsed"));
children.push(Bullet("Navy gradient header (#193458 → #1f3f6a)."));
children.push(Bullet("Unit process name (15 px bold)."));
children.push(Bullet("Description (12 px muted)."));
children.push(Bullet("Counts — N equipment · M set points (live)."));
children.push(Bullet("Pencil icon — edit name/description."));
children.push(Bullet("Bin icon — delete UP. Confirms before destroying. If the UP had set points, they are unlinked but kept in the registry."));
children.push(Bullet("Chevron — collapsed = pointing right, expanded = pointing down."));

children.push(H3("Unit Process card — expanded"));
children.push(Bullet("Step 2 · Equipment associated with this unit process"));
children.push(BulletRich([
  { text: "Autocomplete input — “Type to search and add equipment…”. Suggestions surface live (Doherty <150 ms). Clicking a suggestion adds the equipment chip immediately, with no extra confirmation step.", color: TEXT },
], 1));
children.push(BulletRich([{ text: "Equipment chips — × to remove inline.", color: TEXT }], 1));
children.push(Bullet("Step 3 · Set points"));
children.push(BulletRich([{ text: "Card-style rows, one per set point. Type tag (left), Name + description (centre), Range (right), Unit, ✎.", color: TEXT }], 1));
children.push(BulletRich([{ text: "+ Add set point — opens the redesigned set-point modal pre-linked to this UP.", color: TEXT }], 1));
children.push(BulletRich([{ text: "Transfer Pump groups (4 LT sub-set-points sharing a groupId) collapse into one row labelled “Transfer Pump · 4 levels”.", color: TEXT }], 1));

children.push(H2("2.2  Set Point Types"));
children.push(P("Nine types are supported. Unit is auto-derived from type and shown as a read-only pill below the type dropdown. Implementers never see a free-text “unit” input."));
children.push(makeTable(
  ["Type", "Unit", "Drives"],
  [
    ["Level", "%", "Tank level cut-in / cut-out"],
    ["DO (Dissolved Oxygen)", "mg/L", "Blower ON/OFF and VFD output"],
    ["Differential Pressure", "bar", "Backwash sequence"],
    ["pH", "pH", "Dosing pumps (NaOH / HCl)"],
    ["FRC (Free Residual Chlorine)", "ppm", "NaOCl dosing"],
    ["ORP", "mV", "ORP-correction dosing"],
    ["Flow", "m³/hr", "Pump VFD output"],
    ["Time", "min", "Backwash / decant / fill duration"],
    ["Transfer Pump Set Point", "%", "Inter-tank transfer pump · 4 HMI tags"],
  ],
  [3000, 1500, 4500],
));

children.push(H2("2.3  Add / Edit Set Point modal"));
children.push(P("The modal applies Hick's law: only the fields the implementer can meaningfully set are visible. The current value is fetched from the sensor mapped to the auto-generated HMI tag at commissioning, so it is not asked for."));

children.push(H3("Layout"));
children.push(Bullet("✕ in the top-right corner of the dialog box."));
children.push(Bullet("Centered title (“Add set point” / “Edit set point”) and a centered subtitle “For unit process: <UP name>”. The UP is therefore pinned in the title, not a redundant dropdown."));
children.push(Bullet("Row 1 (Hick's law — flatten the field hierarchy)"));
children.push(BulletRich([{ text: "Set Point Type (left) — selector. Unit hint pill appears immediately below: “Unit: mg/L · auto-derived from set point type.”", color: TEXT }], 1));
children.push(BulletRich([{ text: "Set Point Name (right) — text input.", color: TEXT }], 1));
children.push(Bullet("Description — optional textarea (full width)."));
children.push(Bullet("Safe range — Safe Min and Safe Max side-by-side, with the type-derived unit suffixed inside each input."));
children.push(Bullet("HMI tag preview — pill labelled “HMI TAG · auto-generated”, with the live tag as a monospace chip beneath. Tag updates as the implementer changes type or UP."));
children.push(Bullet("Helper note — “The current value will be fetched from the sensor mapped to this tag at commissioning.”"));
children.push(Bullet("Footer — centered Cancel + primary Save."));

children.push(H3("Doherty threshold behaviours"));
children.push(Bullet("Modal opens with a 180 ms scale-in animation."));
children.push(Bullet("HMI tag preview re-renders within 100 ms of any keystroke or selection change."));
children.push(Bullet("Validation error chip dismisses on the next keystroke. The implementer is never blocked by stale errors."));

children.push(H3("Validation"));
children.push(Bullet("Name is required."));
children.push(Bullet("Safe Min < Safe Max."));
children.push(Bullet("For Transfer Pump, each of the four safe-range pairs must independently satisfy Min < Max."));

children.push(H2("2.4  Transfer Pump Set Point — special case"));
children.push(P("A Transfer Pump Set Point is logically one record but physically four HMI tags / four PLC writes — one for source-start, source-stop, destination-start, destination-stop."));
children.push(Bullet("In the modal — a 2-column grid per tank (Start | Stop), with Safe min and Safe max rows beneath."));
children.push(Bullet("All four sub-records share a groupId / groupName so the UI re-aggregates them into one row on the configuration screen and one card in the drawer."));
children.push(Bullet("HMI tag preview shows all four tags as wrapped chips."));
children.push(Bullet("Audit log writes four entries sharing a group_change_id."));

children.push(H2("2.5  HMI tag generation"));
children.push(Code("Tag = upper(slug(unitProcessName)) + \".\" + upper(slug(type)) + roleSuffix + \"_\" + zeroPad(index, 2) + \"_SP\""));
children.push(P("Examples:"));
children.push(Code("AERATION.DO_03_SP"));
children.push(Code("RE_CIRCULATION.LT_SOURCEMIN_05_SP"));
children.push(Code("PSF_1_CYCLE.TIME_01_SP"));
children.push(P("Slugging — [^A-Z0-9]+ → _, then strip leading/trailing _. Tags are read-only on the UI; the PLC integration team maps each auto-generated tag to the actual PLC tag during commissioning."));

children.push(H2("2.6  Cross-surface sync"));
children.push(P("Whenever a unit process, equipment association, or set point is created, edited, or deleted from this screen, every .cfg-up-stack on the page re-renders. This guarantees that if the user is also showing the Plant Layout drawer in Configuration mode in another column, it stays in sync without manual refresh."));

children.push(SectionDivider());

// 3. Plant Layout — Client view
children.push(H1("3.  Plant Layout — Client View"));
children.push(P("The Plant Layout is the operator's primary surface. It renders the plant as an SVG and overlays live status badges, group control affordances, and a Unit Processes drawer for tuning operator-adjustable values."));

children.push(H2("3.1  Goals"));
children.push(Bullet("Show plant state at a glance. No hunting for a value."));
children.push(Bullet("Make adjusting any set point a one-tap action — drawer → UP card → set-point card → Edit → confirm."));
children.push(Bullet("Never expose configuration affordances. Operators cannot accidentally delete a set point, add equipment, or rename a unit process."));

children.push(H2("3.2  Surface anatomy"));
children.push(H3("Canvas"));
children.push(Bullet("SVG plant layout sourced from the in-house JointJS export. Renders deterministically — same JSON, same layout, every time."));
children.push(Bullet("Zoom controls (top-right) — In, Out, Fit. Current zoom % is displayed."));
children.push(Bullet("Mode toggle pill (top-centre) — see §5."));
children.push(Bullet("Section highlight — clicking any section in the layout dims the rest of the plant and surfaces a contextual drawer for that section."));
children.push(Bullet("Tank-with-pumps progressive disclosure — clicking a basin opens a detail drawer showing only the equipment inside that basin."));

children.push(H3("Unit Processes drawer"));
children.push(P("Right-hand side panel that opens when the operator clicks the “Unit Processes” button."));
children.push(Bullet("Header — Adani SBR Group · N unit processes · M set points."));
children.push(Bullet("Search input — fuzzy match on UP, set point, HMI tag."));
children.push(Bullet("Vertical list of Unit Process cards, each collapsible. Inside each card:"));
children.push(BulletRich([{ text: "Description (one line).", color: TEXT }], 1));
children.push(BulletRich([{ text: "Equipment chips (read-only — no × icon).", color: TEXT }], 1));
children.push(BulletRich([{ text: "Set point cards — one per set point, with the live current value, the safe range, and an Edit button.", color: TEXT }], 1));
children.push(BulletRich([{ text: "LT Transfer Pump groups render as one card with both source and destination ranges visible at a glance.", color: TEXT }], 1));

children.push(H3("Set point card"));
children.push(Bullet("Type tile (left) — short type code (DO / LT / pH …)."));
children.push(Bullet("Name + type (centre)."));
children.push(Bullet("Notification icon — opens notification preferences."));
children.push(Bullet("CURRENT — large monospace live value."));
children.push(Bullet("SAFE RANGE — Min – Max."));
children.push(Bullet("Edit — primary button. Disabled if the set point is inactive."));
children.push(Bullet("HMI tag is not displayed on the operator card — it is engineering metadata, not operationally meaningful."));

children.push(H2("3.3  Edit-value flow"));
children.push(Bullet("Operator taps Edit on a set point card."));
children.push(Bullet("Card expands in-place to reveal a number stepper and a Save button."));
children.push(Bullet("If the new value sits inside the safe range, Save commits to the PLC, the card returns to read state, and the change is logged."));
children.push(Bullet("If the new value sits outside the safe range, a warning modal appears: “This value is outside the safe range. Override?” with reason text required. Saving emits an override audit entry."));
children.push(P("The system never blocks an operator. Every change is logged with user_id, timestamp, hmi_tag, old → new, in_safe_range, override_reason.", { italics: true, color: MUTE }));

children.push(H2("3.4  Group control & interlocks"));
children.push(Bullet("Group Control panel lets the operator start / stop / standby a set of pumps as one unit, respecting per-pump interlocks."));
children.push(Bullet("Time-based remote release — operator can hand control back to the PLC after a configurable interval."));

children.push(H2("3.5  Operator interactions explicitly excluded"));
children.push(Bullet("Cannot create or delete a unit process."));
children.push(Bullet("Cannot add or remove equipment from a unit process."));
children.push(Bullet("Cannot create or delete a set point."));
children.push(Bullet("Cannot edit a set point's name, description, safe range, or HMI tag."));
children.push(P("These actions are reserved for Configuration mode."));

children.push(SectionDivider());

// 4. Plant Layout — Configuration mode
children.push(H1("4.  Plant Layout — Configuration Mode"));
children.push(P("Configuration mode is an in-context alternative to the standalone Set Point Configuration page. It lets implementers do the same work without leaving the plant visualisation, which is useful during commissioning when the implementer is reasoning about geometry and topology at the same time."));

children.push(H2("4.1  Mode toggle"));
children.push(P("A pill toggle is mounted at the top-centre of the Plant Layout canvas. It is the only entry point into Configuration mode."));
children.push(Code("[ 👁 Client view  |  ⚙ Configuration mode ]"));
children.push(Bullet("Default state — Client view (left option active)."));
children.push(Bullet("Selecting Configuration mode tints the canvas with a subtle navy gradient (≈ 4 % alpha) so the implementer is always aware of which mode is active."));
children.push(Bullet("The toggle persists across drawer open/close but not across page reload (intentional — every session opens in safe Client view)."));

children.push(H2("4.2  Drawer contents in Configuration mode"));
children.push(P("When Configuration mode is on, opening the Unit Processes drawer renders the same UP-first interface as the standalone Set Point Configuration page — but inside the drawer."));
children.push(Bullet("Top of the drawer — primary CTA: + Create unit process. Opens the centered Create unit process modal."));
children.push(Bullet("Below the CTA — the same vertical stack of expandable UP cards used on the standalone page."));
children.push(Bullet("All implementer affordances — pencil/bin icons on UP cards, equipment autocomplete, + Add set point — are available exactly as on the configuration page."));
children.push(Bullet("Cross-surface sync — edits performed here are reflected on the standalone configuration page in real time, and vice versa."));

children.push(H2("4.3  Separation guarantees"));
children.push(Bullet("Client view and Configuration mode share zero rendering code in the drawer. Client view is rendered by renderSpDrawer's existing operator path; Configuration mode is rendered by renderSpDrawerConfig which paints a fresh cfg-up-stack into the drawer body."));
children.push(Bullet("This guarantees that improvements or regressions in one mode cannot affect the other."));

children.push(H2("4.4  Why both surfaces?"));
children.push(makeTable(
  ["When the implementer should use…", "Reason"],
  [
    ["Set Point Configuration (standalone page)", "Bulk configuration. The implementer just wants the list view and the modals — no map context needed."],
    ["Plant Layout · Configuration Mode", "Iterative configuration during commissioning. The implementer is walking the SVG, identifying which equipment belongs to which logical process, and naming UPs as they go."],
  ],
  [4500, 4500],
));

children.push(SectionDivider());

// 5. Design principles
children.push(H1("5.  Design Principles"));
children.push(P("All three surfaces are built around the same four principles."));

children.push(H2("5.1  Hick's law"));
children.push(P("Reduce the number of fields and choices the implementer sees at any one time."));
children.push(Bullet("Set point modal collapsed from 7 fields to 5 — current value and unit removed, UP moved to subtitle."));
children.push(Bullet("Set Point Type and Set Point Name placed side-by-side on a single row to flatten the visual hierarchy."));
children.push(Bullet("Transfer Pump form reduced from 12 inputs to 8 (current values for all four roles removed — they come from sensors)."));

children.push(H2("5.2  Doherty threshold"));
children.push(P("All user actions surface feedback within 400 ms."));
children.push(Bullet("Modal open animation under 200 ms."));
children.push(Bullet("HMI tag preview re-renders within 100 ms of any change."));
children.push(Bullet("Equipment autocomplete renders suggestions on every keystroke (≈ 20 ms)."));
children.push(Bullet("Inline form errors clear on the next keystroke — never carry stale state."));
children.push(Bullet("Drawer set-point cards lift 1 px on hover for instant affordance feedback."));

children.push(H2("5.3  Progressive disclosure"));
children.push(P("Surface what the user needs at the level of detail they need it. Defer everything else behind a deliberate action."));
children.push(Bullet("UP cards collapse to a one-line header; equipment and set points appear only when expanded."));
children.push(Bullet("Tank-with-pumps internals only reveal on click in the plant layout."));
children.push(Bullet("Description and Unit hint sit below their parent fields, never alongside them."));

children.push(H2("5.4  Brand consistency"));
children.push(P("Primary colour #193458 is applied uniformly to:"));
children.push(Bullet("Primary buttons (linear gradient #224170 → #193458)."));
children.push(Bullet("Form labels, focus rings (3 px halo at 12 % alpha)."));
children.push(Bullet("UP card headers (linear gradient #1f3f6a → #193458 navy)."));
children.push(Bullet("Mode-toggle active state."));
children.push(Bullet("Configuration-mode canvas tint."));

children.push(SectionDivider());

// 6. Data model & audit
children.push(H1("6.  Data Model & Audit"));

children.push(H2("6.1  Set Point record"));
children.push(Code("interface Setpoint {"));
children.push(Code("  id: string;"));
children.push(Code("  type: SetpointType;       // 1 of 9 types"));
children.push(Code("  name: string;"));
children.push(Code("  description?: string;"));
children.push(Code("  unit: string;             // auto-derived from type"));
children.push(Code("  current: number;          // fetched from sensor at runtime"));
children.push(Code("  min: number; max: number; // operator safe-range"));
children.push(Code("  hmiTag: string;           // auto-generated, read-only"));
children.push(Code("  active: boolean;"));
children.push(Code("  unitProcessId?: string;"));
children.push(Code("  // Transfer Pump only:"));
children.push(Code("  groupId?: string;  groupName?: string;"));
children.push(Code("  subRole?: 'SOURCEMIN' | 'SOURCEMAX' | 'DESTMIN' | 'DESTMAX';"));
children.push(Code("}"));

children.push(H2("6.2  Audit log entry"));
children.push(Code("{"));
children.push(Code("  ts: '2026-06-02T11:32:14.503Z',"));
children.push(Code("  user_id: 'op-mihir',"));
children.push(Code("  hmi_tag: 'AERATION.DO_03_SP',"));
children.push(Code("  from: 2.0,"));
children.push(Code("  to: 2.3,"));
children.push(Code("  in_safe_range: true,"));
children.push(Code("  override_reason: null,"));
children.push(Code("  note: 'Bumped target after settling phase'"));
children.push(Code("}"));
children.push(P("Transfer Pump writes emit four entries sharing a group_change_id so the audit viewer can collapse them.", { italics: true, color: MUTE }));

children.push(SectionDivider());

// 7. Open questions
children.push(H1("7.  Open Questions for Sign-off"));
children.push(makeTable(
  ["#", "Question", "Owner"],
  [
    ["1", "Confirm DO unit (mg/L vs bar) and FRC unit (ppm vs mg/L) with the plant team.", "Process eng"],
    ["2", "Final format for the auto-generated tag → PLC tag mapping table (CSV upload? UI mapping screen?).", "PLC integration"],
    ["3", "Transfer Pump composite write — atomic 4-write transaction or sequential? What's the recovery path if write #3 fails?", "Backend"],
    ["4", "Should Configuration mode persist across page reload, or always default back to Client view? PRD currently says always-Client.", "Product"],
    ["5", "Soft caution bands inside the hard min/max — kept for v1 or deferred to v2?", "Product / PLC"],
  ],
  [600, 6400, 2000],
));

children.push(SectionDivider());

// 8. Acceptance criteria
children.push(H1("8.  Acceptance Criteria"));
children.push(H2("8.1  Set Point Configuration"));
children.push(Bullet("Implementer can create a unit process from an empty state and see it appear without page reload."));
children.push(Bullet("Implementer can search and add equipment via the autocomplete, with each click producing a chip and clearing the input within 200 ms."));
children.push(Bullet("Implementer can add a set point to a UP and see the HMI tag preview update live as they change type."));
children.push(Bullet("Implementer can delete a UP, with a confirm dialog that warns about unlinked set points if any exist."));
children.push(Bullet("Search filters across UPs, set point names, equipment names, and HMI tags."));

children.push(H2("8.2  Plant Layout · Client view"));
children.push(Bullet("Operator can open the drawer and see every UP, every set point, and the live current value for each."));
children.push(Bullet("Operator can edit any set point and have the new value reflected on screen within 1 second of save."));
children.push(Bullet("Operator cannot reach any create/delete/rename affordance through the drawer."));
children.push(Bullet("Out-of-range values trigger the warning modal and require an override reason."));

children.push(H2("8.3  Plant Layout · Configuration Mode"));
children.push(Bullet("Toggle pill defaults to Client view on every page load."));
children.push(Bullet("Switching to Configuration mode tints the canvas and changes the drawer body to the cfg-up-stack."));
children.push(Bullet("All actions available on the standalone Set Point Configuration page are available in the drawer in Configuration mode."));
children.push(Bullet("Edits made in either surface propagate to the other within 100 ms."));
children.push(Bullet("Switching back to Client view restores the operator drawer with no residual configuration UI."));

// ============================================================
// Document
// ============================================================
const doc = new Document({
  creator: "Digital Paani",
  title: "PRD — Set Point Configuration & Plant Layout",
  description: "Remote Control PRD covering Set Point Configuration, Plant Layout (Client View) and Plant Layout (Configuration Mode).",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: TEXT } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri", color: BRAND },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: BRAND },
        paragraph: { spacing: { before: 260, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: TEXT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "PRD · Remote Control · v1.0", font: "Calibri", size: 18, color: MUTE })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", font: "Calibri", size: 18, color: MUTE }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: MUTE }),
            new TextRun({ text: " · ", font: "Calibri", size: 18, color: MUTE }),
            new TextRun({ text: "Digital Paani · Confidential", font: "Calibri", size: 18, color: MUTE, italics: true }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, "PRD.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote:", out, "(" + buf.length + " bytes)");
});
