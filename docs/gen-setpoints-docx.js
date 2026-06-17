// Generate Set Points developer documentation as a Word document.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType,
  HeadingLevel, ExternalHyperlink, PageOrientation,
} = require('docx');

// ---------- helpers ----------
const FONT_BODY = "Calibri";
const FONT_CODE = "Consolas";

// 1 inch = 1440 DXA. US Letter content width with 1" margins = 9360.
const CONTENT_WIDTH = 9360;

const border = { style: BorderStyle.SINGLE, size: 4, color: "C7CDD9" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, before: 60 },
    ...opts,
    children: opts.children || [new TextRun({ text, font: FONT_BODY, size: 22 })],
  });
}

function H(level, text) {
  const heading = ["Heading1","Heading2","Heading3","Heading4"][level-1];
  return new Paragraph({
    heading: HeadingLevel[`HEADING_${level}`],
    children: [new TextRun({ text, font: FONT_BODY, bold: true,
      size: level === 1 ? 36 : level === 2 ? 30 : 26,
      color: level === 1 ? "0E1F3A" : level === 2 ? "1C3A6E" : "2A6CF0",
    })],
    spacing: { before: level === 1 ? 360 : 280, after: level === 1 ? 180 : 140 },
  });
}

function code(text) {
  return new TextRun({ text, font: FONT_CODE, size: 20, color: "1C3A6E",
    shading: { fill: "F2F4F8", type: ShadingType.CLEAR } });
}

// Mini inline-markdown parser for **bold**, `code`, `[text](url)`
function inlineRuns(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(new TextRun({ text: text.slice(lastIdx, m.index), font: FONT_BODY, size: 22 }));
    }
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(new TextRun({ text: tok.slice(2, -2), font: FONT_BODY, size: 22, bold: true }));
    } else if (tok.startsWith("`")) {
      out.push(code(tok.slice(1, -1)));
    } else {
      const linkMatch = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      out.push(new ExternalHyperlink({
        children: [new TextRun({ text: linkMatch[1], font: FONT_BODY, size: 22, color: "2A6CF0", underline: {} })],
        link: linkMatch[2],
      }));
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) {
    out.push(new TextRun({ text: text.slice(lastIdx), font: FONT_BODY, size: 22 }));
  }
  return out.length ? out : [new TextRun({ text, font: FONT_BODY, size: 22 })];
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100, before: 0 },
    ...opts,
    children: inlineRuns(text),
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: inlineRuns(text),
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 60 },
    children: inlineRuns(text),
  });
}

function quote(text) {
  return new Paragraph({
    spacing: { after: 120, before: 60 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "2A6CF0", space: 12 } },
    children: [new TextRun({ text, font: FONT_BODY, size: 22, italics: true, color: "4A5A72" })],
  });
}

function codeBlock(text) {
  // Render each line as its own paragraph with shading
  const lines = text.split("\n");
  return lines.map((ln, i) => new Paragraph({
    spacing: { after: 0, before: 0, line: 240 },
    indent: { left: 240 },
    shading: { fill: "F4F6FA", type: ShadingType.CLEAR },
    border: i === 0
      ? { top: { style: BorderStyle.SINGLE, size: 4, color: "DCE2EA" } }
      : i === lines.length - 1
      ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DCE2EA" } }
      : undefined,
    children: [new TextRun({ text: ln || " ", font: FONT_CODE, size: 20, color: "1C3A6E" })],
  }));
}

// ---------- Tables ----------
function tableHeaderCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "0E1F3A", type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({ children: [
      new TextRun({ text, font: FONT_BODY, size: 20, bold: true, color: "FFFFFF" })
    ] })],
  });
}

function tableCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.alt ? { fill: "F8FAFC", type: ShadingType.CLEAR } : { fill: "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({ spacing: { after: 0 }, children: inlineRuns(text) })],
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h,i) => tableHeaderCell(h, widths[i])) }),
      ...rows.map((row, idx) => new TableRow({
        children: row.map((c,i) => tableCell(c, widths[i], { alt: idx % 2 === 1 })),
      })),
    ],
  });
}

// ---------- Build document ----------
const children = [];

// Cover
children.push(new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Digital Paani", font: FONT_BODY, size: 18, bold: true, color: "2A6CF0", allCaps: true })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Set Points", font: FONT_BODY, size: 56, bold: true, color: "0E1F3A" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { after: 220 },
  children: [new TextRun({ text: "Developer Documentation", font: FONT_BODY, size: 32, color: "4A5A72" })],
}));
children.push(new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "2A6CF0", space: 8 } },
  spacing: { after: 240 },
  children: [new TextRun({ text: " ", size: 2 })],
}));
children.push(quote("Audience: developers implementing set-point configuration and runtime behaviour. Last updated: with the addition of the Transfer Pump Set Point type and the standalone Set Point Configuration screen."));

// 1. What is a set point
children.push(H(1, "1. What is a set point?"));
children.push(para("A " + "set point" + " is a numeric threshold or target value stored on the PLC that drives equipment behaviour (start / stop / dose / open / close / VFD output). The PLC’s automation logic is fixed — only the threshold values are overwritten by operators through this software."));
children.push(para("Every set point has an HMI Tag that maps 1:1 to a PLC tag. Tags are auto-generated by the configuration UI (read-only); the PLC integration team maps each auto-generated tag to the actual PLC tag during plant commissioning."));

// 2. Common fields
children.push(H(1, "2. Common fields (every type)"));
children.push(para("Every set point — regardless of type — captures the following at configuration time:"));
children.push(makeTable(
  ["Field", "Type", "Required", "Notes"],
  [
    ["Set Point Type", "enum", "✓", "One of the 9 types in §3"],
    ["Set Point Name", "string", "✓", "Operator-facing label (e.g. CASS Basin 1 high level cut-in)"],
    ["Set Point Description", "text", "optional", "When the set point fires, what equipment behaviour it drives"],
    ["Set Point Min (safe min)", "number", "✓", "Floor of the allowed override range. Values below trigger a soft warning"],
    ["Set Point Max (safe max)", "number", "✓", "Ceiling. Values above trigger a soft warning"],
    ["HMI Set Point Tag", "string", "auto", "Generated from `<UP_NAME>.<TYPE>[_<ROLE>]_<NN>_SP`. Read-only in UI"],
    ["Linked Unit Process", "reference", "optional", "The unit process this set point belongs to (drives Dashboard grouping)"],
  ],
  [2200, 1400, 1200, 4560]
));

children.push(H(2, "Validation (server + client)"));
children.push(bullet("`Min < Max` — always."));
children.push(bullet("`Current` (the live set point value the PLC reads) must satisfy `Min ≤ Current ≤ Max`."));
children.push(bullet("Name is non-empty and trimmed."));
children.push(bullet("HMI Tag uniqueness is enforced when persisting (auto-generation already keeps uniqueness via the `_NN` suffix)."));

children.push(H(2, "Override semantics"));
children.push(bullet("The system **never blocks** an operator setpoint change."));
children.push(bullet("If the operator’s new value falls **outside** `[Min, Max]`, a warning modal opens and an explicit override is required."));
children.push(bullet("Every change (in-range or override) is logged: `old → new`, `user_id`, `timestamp`, `hmi_tag`, `note`."));

// 3. Types
children.push(H(1, "3. Set point types & their config questions"));
children.push(para("Each row below describes what to ask the implementer at configuration time."));

const types = [
  { num:"3.1", name:"Level", unit:"%", purpose:"Tank level threshold (e.g. \"transfer pump starts at 70%\")", note:null },
  { num:"3.2", name:"DO (Dissolved Oxygen)", unit:"mg/L", purpose:"Drives blower ON/OFF and VFD output (RPM / Hz / current)", note:"The brief listed `bar`; the platform convention is `mg/L`. Confirm with the plant team before finalising." },
  { num:"3.3", name:"Differential Pressure", unit:"bar", purpose:"Triggers backwash sequence (valves ON/OFF)", note:null },
  { num:"3.4", name:"pH", unit:"pH (dimensionless 0–14)", purpose:"Triggers dosing pumps (NaOH / HCl)", note:null },
  { num:"3.5", name:"FRC (Free Residual Chlorine)", unit:"ppm (or mg/L)", purpose:"Triggers NaOCl dosing pump", note:null },
  { num:"3.6", name:"ORP (Oxidation-Reduction Potential)", unit:"mV", purpose:"Triggers ORP-correction dosing", note:"Values commonly negative for anoxic processes." },
  { num:"3.7", name:"Flow", unit:"m³/hr", purpose:"Changes VFD output of permeate / feed pumps (no ON/OFF toggle)", note:null },
  { num:"3.8", name:"Time", unit:"minutes (default) — also seconds and hours", purpose:"Backwash duration, decant duration, fill duration, etc.", note:null },
];
for (const t of types) {
  children.push(H(3, `${t.num} ${t.name}`));
  children.push(bullet(`Inputs: one reading`));
  children.push(bullet(`Unit: \`${t.unit}\``));
  children.push(bullet(`Safe range: Min, Max`));
  children.push(bullet(`Purpose: ${t.purpose}`));
  if (t.note) children.push(quote(t.note));
}

// 3.9 Transfer Pump
children.push(H(3, "3.9 Transfer Pump Set Point  ★ special case"));
children.push(para("A Transfer Pump Set Point is **logically one** set point that physically resolves to **four HMI tags** (and four PLC writes). It controls a pump that moves liquid from a source tank to a destination tank."));

children.push(H(3, "Inputs"));
children.push(makeTable(
  ["Sub-field", "What", "Each has its own"],
  [
    ["Source Tank Start Level", "Level above which pump starts", "min, max (safe range)"],
    ["Source Tank Stop Level",  "Level at/below which pump stops", "min, max"],
    ["Destination Tank Start Level", "Level above which transfer holds", "min, max"],
    ["Destination Tank Stop Level",  "Level at/below which transfer resumes", "min, max"],
  ],
  [2800, 3960, 2600]
));
children.push(para("All four are in `%`."));

children.push(H(3, "Validation"));
children.push(bullet("**Per-tank ordering**: `Source Start ≤ Source Stop`, `Destination Start ≤ Destination Stop`."));
children.push(bullet("**Per-sub-setpoint safe ranges**: `min ≤ current ≤ max` for each of the four values independently."));
children.push(bullet("**Min < Max** on each sub-setpoint’s safe range."));

children.push(H(3, "HMI Tag generation"));
children.push(para("A single Transfer Pump set point produces four tags (one per sub-role):"));
children.push(...codeBlock(
`<UP_NAME>.LT_SOURCEMIN_<NN>_SP    ← Source Start
<UP_NAME>.LT_SOURCEMAX_<NN+1>_SP  ← Source Stop
<UP_NAME>.LT_DESTMIN_<NN+2>_SP    ← Destination Start
<UP_NAME>.LT_DESTMAX_<NN+3>_SP    ← Destination Stop`
));
children.push(para("Internally we tag the four set-point records with a shared **`groupId`** and **`groupName`** so the UI can re-aggregate them into one row in the Configuration screen and one card in the operator drawer/dashboard."));

children.push(H(3, "Operator behaviour"));
children.push(bullet("The operator **edits all four values in one form** (single \"Edit\" action → 4 inputs → Save → 4 PLC writes)."));
children.push(bullet("The Dashboard renders them as **one card** showing both ranges at a glance."));
children.push(bullet("Audit log writes a single grouped entry referencing all four old → new pairs."));

// 4. Data model
children.push(H(1, "4. Data model (TypeScript-ish)"));
children.push(...codeBlock(
`type SetpointType =
  | "Level" | "DO" | "Differential Pressure" | "pH" | "FRC" | "ORP"
  | "Flow" | "Time" | "Transfer Pump";

interface SetpointBase {
  id: string;
  type: SetpointType;
  name: string;
  description?: string;
  unit: string;
  current: number;     // live PLC tag value
  min: number;         // safe range floor
  max: number;         // safe range ceiling
  hmiTag: string;      // auto-generated
  active: boolean;     // false = disabled at config layer
  unitProcessId?: string;
  source: string;      // 'PLC default' | 'Operator override · DD MMM' | 'Created · DD MMM'
  history: Array<{
    ts: string;
    kind: "value" | "config";
    from?: any; to?: any;
    changes?: Record<string, { from: any; to: any }>;
    who: string;
    note?: string;
  }>;
}

// Single-value types share SetpointBase as-is.
// Transfer Pump materialises as FOUR rows of the same shape with these extras:
interface TransferPumpMember extends SetpointBase {
  type: "Transfer Pump";
  subRole: "SOURCEMIN" | "SOURCEMAX" | "DESTMIN" | "DESTMAX";
  groupId: string;       // shared across all 4
  groupName: string;     // shared
}`
));
children.push(quote("Backwards-compat note: the prototype's stored type for Transfer Pump records is \"LT\" (legacy). The display label is \"Transfer Pump Set Point\". New code should accept both spellings."));

// 5. Where set points get configured
children.push(H(1, "5. Where set points get configured"));
children.push(para("The prototype exposes two configuration surfaces:"));
children.push(makeTable(
  ["Surface", "Audience", "What it does", "Where"],
  [
    ["Set Point Configuration", "Implementer / Admin", "Plain list of every set point; CRUD with the common fields above + Transfer Pump sub-form", "Page selector → Set Point Configuration"],
    ["Studio", "Implementer", "Drag-arrange dashboard layout; per-widget inspector also exposes the full set-point editor", "Page selector → ⚙ Studio (configure)"],
  ],
  [2200, 1800, 3460, 1900]
));
children.push(para("Both surfaces write to the same global registry. The Dashboard and the Plant View drawer **only read** from it."));
children.push(para("The simple Configuration screen exists for situations where the implementer just needs to add or edit set points without touching the visual dashboard."));

// 6. HMI auto-gen
children.push(H(1, "6. Auto-generated HMI tag rules"));
children.push(...codeBlock(
`Tag = upper(slug(unitProcessName)) + "."
    + upper(slug(type))
    + roleSuffix
    + "_" + zeroPad(index, 2) + "_SP"`
));
children.push(para("Examples:"));
children.push(bullet("`AERATION.DO_03_SP`"));
children.push(bullet("`RE_CIRCULATION.LT_SOURCEMIN_05_SP`"));
children.push(bullet("`PSF_1_CYCLE.TIME_01_SP`"));
children.push(para("Slugging rule: `[^A-Z0-9]+` → `_`, then strip leading/trailing `_`."));

// 7. Audit log
children.push(H(1, "7. Audit log fields (every set-point write)"));
children.push(...codeBlock(
`{
  "ts": "2026-06-01T11:32:14.503Z",
  "user_id": "op-mihir",
  "hmi_tag": "AERATION.DO_03_SP",
  "set_point_id": "sp-do-cass1",
  "from": 2.0,
  "to": 2.3,
  "in_safe_range": true,
  "override_reason": null,
  "note": "Bumped target after settling phase",
  "unit_process_id": "up-aeration"
}`
));
children.push(para("For Transfer Pump writes, emit **four entries** (one per sub-role) sharing a `group_change_id` so the log viewer can re-collapse them."));

// 8. Open questions
children.push(H(1, "8. Open questions for the PLC integration team"));
children.push(numbered("**Tag mapping** — confirm the format the PLC team needs for the auto-generated tag → PLC tag mapping table (CSV? UI?)."));
children.push(numbered("**Unit consistency** — finalise DO unit (`mg/L` vs `bar`) and FRC unit (`ppm` vs `mg/L`) with the domain team."));
children.push(numbered("**Transfer Pump composite write** — atomic 4-write transaction or sequential? What's the recovery path if write #3 fails?"));
children.push(numbered("**Safe range vs hard range** — Phase 2 doc mentioned soft caution bands inside the hard min/max. Are we keeping that distinction in v1 of this screen, or only the single safe-range pair (Min/Max)?"));

// ---------- Build the document ----------
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT_BODY, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: FONT_BODY, color: "0E1F3A" },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: FONT_BODY, color: "1C3A6E" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT_BODY, color: "2A6CF0" },
        paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 240 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, "set-points.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("OK · wrote", outPath, "·", buffer.length, "bytes");
});
