/* eslint-disable */
// Generates docs/Group-Remote-Control-Guide.docx — two step-by-step guides:
//   A. Configuring a Group (software side)
//   B. Using Group Remote Control (operator side)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageNumber, Header, Footer,
} = require("docx");

const BRAND = "193458";
const TEXT  = "1a2333";
const MUTE  = "5b6878";
const RULE  = "d6dde7";
const SOFT  = "f4f6fa";
const WARN  = "a76300";
const WARNBG = "fff5e0";

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: 300 },
    alignment: opts.alignment ?? AlignmentType.LEFT,
    children: [new TextRun({ text, font: "Calibri", size: opts.size ?? 22, color: opts.color ?? TEXT, bold: opts.bold, italics: opts.italics })],
  });

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 160 },
  children: [new TextRun({ text, font: "Calibri", size: 36, bold: true, color: BRAND })],
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 260, after: 100 },
  children: [new TextRun({ text, font: "Calibri", size: 28, bold: true, color: BRAND })],
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 80 },
  children: [new TextRun({ text, font: "Calibri", size: 24, bold: true, color: TEXT })],
});

const Step = (n, title) => new Paragraph({
  spacing: { before: 280, after: 120 },
  children: [
    new TextRun({ text: `STEP ${n}  `, font: "Calibri", size: 20, bold: true, color: "FFFFFF" }),
    new TextRun({ text: "  ", font: "Calibri", size: 20 }),
    new TextRun({ text: title, font: "Calibri", size: 28, bold: true, color: BRAND }),
  ],
  shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: BRAND, space: 8 } },
});

// Numbered substep — uses literal numbering rendered as bold text (avoids
// docx-js list numbering complexity while keeping a clean look)
const Substep = (n, text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60, line: 300 },
  indent: { left: 360, hanging: 360 },
  children: [
    new TextRun({ text: `${n}.  `, font: "Calibri", size: 22, bold: true, color: BRAND }),
    new TextRun({ text, font: "Calibri", size: 22, color: TEXT, italics: opts.italics }),
  ],
});

const Bullet = (text, level = 0) => new Paragraph({
  bullet: { level },
  spacing: { before: 40, after: 40, line: 280 },
  children: [new TextRun({ text, font: "Calibri", size: 22, color: TEXT })],
});

const Code = (text) => new Paragraph({
  spacing: { before: 60, after: 60 },
  shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
  children: [new TextRun({ text, font: "Consolas", size: 20, color: BRAND })],
});

const Callout = (title, body, kind = "info") => {
  const bg = kind === "warn" ? WARNBG : SOFT;
  const accent = kind === "warn" ? WARN : BRAND;
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: bg, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: accent, space: 10 } },
    children: [
      new TextRun({ text: `${title}  `, font: "Calibri", size: 22, bold: true, color: accent }),
      new TextRun({ text: body, font: "Calibri", size: 22, color: TEXT }),
    ],
  });
};

const SectionDivider = () => new Paragraph({
  spacing: { before: 120, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
  children: [new TextRun("")],
});

// Table helpers
function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: BRAND, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    children: [new Paragraph({ children: [new TextRun({ text, font: "Calibri", size: 20, bold: true, color: "FFFFFF" })] })],
  });
}
function bodyCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts.fill || "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({ children: [new TextRun({ text, font: "Calibri", size: 20, color: TEXT, bold: opts.bold })] })],
  });
}
function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
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
const children = [];

// Cover
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1400, after: 120 },
    children: [new TextRun({ text: "STEP-BY-STEP GUIDE", font: "Calibri", size: 22, bold: true, color: MUTE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: "Group Remote Control", font: "Calibri", size: 52, bold: true, color: BRAND })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 60 },
    children: [new TextRun({ text: "Configuration & Operation", font: "Calibri", size: 28, color: TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 60 },
    children: [new TextRun({ text: "Adani Mumbai · Sewage Treatment Plant", font: "Calibri", size: 22, color: MUTE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 40 },
    children: [new TextRun({ text: `Version 1.0 · ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, font: "Calibri", size: 22, color: MUTE })],
  }),
  new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
);

// ============================================================
// Intro
// ============================================================
children.push(H1("About this guide"));
children.push(P("This guide is split into two independent walkthroughs:"));
children.push(Bullet("Part A — Configuring a group (software side). For the implementer / commissioning engineer who is bringing a new group online."));
children.push(Bullet("Part B — Using Group Remote Control (operator side). For the operator who needs to start, stop, or hand control of a group back to the PLC."));
children.push(P("Each part is self-contained — read only the one that applies to your task."));

children.push(SectionDivider());

// ============================================================
// PART A — Configuring a group
// ============================================================
children.push(H1("Part A · Configuring a group"));
children.push(P("A group is the named collection of equipment that the operator will later start, stop, or place into standby together. Configuring a group is a three-step workflow: name it, associate the equipment that belongs to it, and confirm."));
children.push(Callout("Before you start", "You need an implementer account and the list of equipment IDs that will participate in the new group. Equipment must already exist in the platform's catalog."));

// STEP 1
children.push(Step(1, "Create the group"));
children.push(Substep(1, "Open the configuration screen from the page selector."));
children.push(Substep(2, "Click + Create group in the top-right of the screen."));
children.push(Substep(3, "A centered modal opens. Enter the following:"));
children.push(Bullet("Group Name — required. A short, operator-facing label (for example, “Adani SBR Group”, “PSF Train 1”, “RO Skid B”).", 1));
children.push(Bullet("Description — optional. One line that explains what the group does or when it runs.", 1));
children.push(Substep(4, "Click Save group. The modal closes and the new group appears as a card at the top of the configuration stack, auto-expanded so you can move to Step 2 immediately."));
children.push(Callout("Naming guidance", "Use a name the operator will recognise in a stressful situation. Avoid internal codes — pick a name that matches what is written on the panel or the SOP."));

// STEP 2
children.push(Step(2, "Associate equipment with the group"));
children.push(P("With the group card expanded, find the Equipment section."));
children.push(Substep(1, "Click into the search box labelled “Type to search and add equipment…”."));
children.push(Substep(2, "Start typing. The list filters live — by name and by equipment ID."));
children.push(Substep(3, "Click any suggestion. The equipment instantly appears as a chip below the search box. The search box clears and is ready for the next entry."));
children.push(Substep(4, "Repeat until every piece of equipment that should respond to this group's commands is listed."));
children.push(Substep(5, "Removing equipment — click the × on any chip to detach that equipment from the group. There is no confirmation prompt; the change is immediate and reversible."));
children.push(Callout("Equipment can belong to more than one group", "Re-using the same pump or blower across multiple groups is allowed. The platform reconciles overlapping commands using the interlock rules already configured in the PLC."));

// STEP 3
children.push(Step(3, "Review and finish"));
children.push(Substep(1, "Scan the card header — it should show the correct equipment count and group name."));
children.push(Substep(2, "Click the chevron on the card header to collapse it. The card now lives in the configuration stack alongside any others you have created."));
children.push(Substep(3, "The group is now visible to the operator. They will see it in the Group Control panel on the plant layout the next time they refresh that view."));

children.push(H2("Managing groups after creation"));
children.push(makeTable(
  ["Action", "Where", "What happens"],
  [
    ["Rename or update description", "Pencil icon on the group card header", "Opens the same modal with current values pre-filled."],
    ["Add equipment", "Search box inside the expanded card", "Same live autocomplete as during creation."],
    ["Remove equipment", "× on the equipment chip", "Equipment detaches immediately; no confirm."],
    ["Delete the group", "Bin icon on the group card header", "Asks to confirm. Equipment is unaffected — only the group definition is removed."],
    ["Search across groups", "Search bar at the top of the page", "Filters by group name, description, and equipment names."],
  ],
  [2400, 2700, 3900],
));

children.push(Callout("Validation", "Group name is required and cannot be empty. Two groups can share a name, but a warning will appear if you try to save a duplicate. There is no enforced minimum equipment count — an empty group is allowed (operators just see “0 equipment” on it)."));

children.push(SectionDivider());

// ============================================================
// PART B — Using Group Remote Control
// ============================================================
children.push(H1("Part B · Using Group Remote Control"));
children.push(P("Group Remote Control lets you start, stop, or place an entire group of equipment into standby with one action — without overriding the PLC's safety logic. Use it when you need to bring a train, skid, or section up or down as one."));
children.push(Callout("When to use this", "Group control is for coordinated operations — e.g. bringing the SBR train online for the morning shift. For routine threshold tuning of a single set point, use the Unit Processes drawer instead."));

children.push(H2("B.1  Opening the Group Control panel"));
children.push(Substep(1, "On the Plant Layout, click the Group Control button in the top navigation."));
children.push(Substep(2, "The Group Control side panel slides in from the right. It is labelled with the group's name (e.g. “Adani SBR Group”) and the live equipment count."));
children.push(Substep(3, "If you have more than one group configured, use the group selector at the top of the panel to switch between them."));

children.push(H2("B.2  Reading the Group Mode card"));
children.push(P("The top card of the panel — Group Mode — shows whether the group is currently under remote control or running locally on the PLC."));
children.push(makeTable(
  ["Status", "Meaning", "What you can do"],
  [
    ["Local", "PLC is running the group autonomously based on its automation logic.", "Read-only. Switch to Remote to take control."],
    ["Remote", "Group is accepting commands from this software.", "Start / Stop / Standby the group; control individual equipment below."],
    ["Unavailable", "Remote link is not negotiated, or the group has no equipment configured.", "Click Refresh status. If the message persists, escalate to the controls engineer."],
  ],
  [1800, 4200, 3000],
));

children.push(H3("Switching from Local to Remote"));
children.push(Substep(1, "Click Request Remote Control. A technical loader appears showing the link negotiation with the PLC."));
children.push(Substep(2, "The loader runs to completion (typically 3–5 seconds). On success, Group Mode flips to Remote and the action buttons become active."));
children.push(Substep(3, "If negotiation fails, the loader reports the failure reason. The group stays in Local. Retry, or escalate if the failure is persistent."));

children.push(H2("B.3  Group-level actions"));
children.push(P("Once Group Mode is Remote, four group-level actions are available."));
children.push(Bullet("Start group — commands every equipment in the group to its running state, in the order defined by the PLC's startup sequence. Interlocks are respected."));
children.push(Bullet("Stop group — commands every equipment to stop, again in PLC-defined order."));
children.push(Bullet("Standby — leaves equipment energised but holds it in a safe idle (for example, pumps stay primed but do not run)."));
children.push(Bullet("Refresh status — re-reads the PLC. Use this if a panel field looks stale."));
children.push(Callout("Interlocks are never bypassed", "Group commands are sent equipment-by-equipment in PLC-defined order. If an interlock blocks a piece of equipment, that equipment does not move and the panel reports it inline. The group action does not “fail” as a whole — partial state is shown and you can retry the blocked items individually."));

children.push(H2("B.4  Controlling individual equipment inside the group"));
children.push(P("Below Group Mode is the Equipments card. Each row shows one equipment with its live status and direct controls."));
children.push(Substep(1, "Find the equipment in the list. Each row shows the equipment name, its type (pump, blower, valve…), and its current state (Running, Stopped, Standby, Fault)."));
children.push(Substep(2, "Use the inline action buttons to drive that single equipment. Available actions vary by equipment type:"));
children.push(Bullet("Pumps and blowers — Start, Stop, Standby.", 1));
children.push(Bullet("Valves — Open, Close.", 1));
children.push(Bullet("VFD-driven equipment — Set output (opens a small step input).", 1));
children.push(Substep(3, "Every individual action respects the same interlocks as group-level actions. If an interlock blocks a command, the affected row shows an interlock badge with the reason (e.g. “Upstream valve closed”)."));

children.push(H2("B.5  Releasing remote control back to the PLC"));
children.push(P("When you are done with remote control of a group, hand control back so the PLC's automation can resume."));
children.push(Substep(1, "On the Group Mode card, click Release to Local."));
children.push(Substep(2, "Optionally, set a delayed release — for example, “return to Local in 30 minutes.” The panel will show a countdown and switch back automatically when it elapses."));
children.push(Substep(3, "Confirm the release. The Group Mode flips back to Local; all action buttons are disabled."));
children.push(Callout("Auto-release safety net", "If the platform loses its link to this software for more than 5 minutes, the PLC automatically returns the group to Local on its own. This is a safety feature — you can rely on it, but the right habit is to release manually when you finish."));

children.push(H2("B.6  Audit and logging"));
children.push(P("Every group-level and individual-equipment action is logged. The audit entry contains:"));
children.push(Code("{ ts, user_id, group, equipment_id?, action, before, after, link_status, note? }"));
children.push(P("Group-level commands produce one parent entry plus one child entry per equipment that received a command, so the audit viewer can collapse or expand the change set.", { italics: true, color: MUTE }));

children.push(SectionDivider());

// ============================================================
// Quick reference
// ============================================================
children.push(H1("Quick reference"));
children.push(makeTable(
  ["I want to…", "Go to", "Tap"],
  [
    ["Create a new group", "Configuration screen", "+ Create group → name → Save"],
    ["Add equipment to a group", "Group card → expanded", "Search box → click suggestion"],
    ["Rename a group", "Group card header", "Pencil icon"],
    ["Delete a group", "Group card header", "Bin icon → confirm"],
    ["Take a group on Remote", "Plant Layout → Group Control panel", "Request Remote Control"],
    ["Start the whole group", "Group Control panel → Group Mode", "Start group (Remote only)"],
    ["Control one equipment in a group", "Group Control panel → Equipments", "Inline action on that row"],
    ["Hand control back to PLC", "Group Control panel → Group Mode", "Release to Local"],
  ],
  [3000, 3500, 2400],
));

children.push(SectionDivider());

children.push(H1("Glossary"));
children.push(makeTable(
  ["Term", "Definition"],
  [
    ["Group", "A named collection of equipment that can be commanded together from this software."],
    ["Group Mode", "Whether the group is currently under PLC control (Local) or this software's control (Remote)."],
    ["Interlock", "A safety rule on the PLC that prevents one equipment from running unless the conditions around it are met."],
    ["Local", "PLC is running the group autonomously. This software can read state but cannot send commands."],
    ["Remote", "This software has the right to send commands to the group. Interlocks still apply."],
    ["Standby", "Safe-idle state — equipment is energised but not running. Faster to bring back online than from Stopped."],
    ["Release to Local", "The act of explicitly returning control of a group to the PLC's automation."],
    ["Auto-release", "PLC's safety mechanism that returns a group to Local if the software link is lost for more than 5 minutes."],
  ],
  [2200, 6800],
));

// ============================================================
const doc = new Document({
  creator: "Digital Paani",
  title: "Group Remote Control — Step-by-Step Guide",
  description: "Step-by-step configuration and operation guide for group-based remote control.",
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
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Group Remote Control · Step-by-Step Guide · v1.0", font: "Calibri", size: 18, color: MUTE })],
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
            new TextRun({ text: " · Digital Paani · Confidential", font: "Calibri", size: 18, color: MUTE, italics: true }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, "Group-Remote-Control-Guide.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote:", out, "(" + buf.length + " bytes)");
});
