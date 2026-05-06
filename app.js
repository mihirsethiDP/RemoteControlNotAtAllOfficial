// ---------- Equipment model ----------
const DEVICES = {
  SBR1_INLET: { name: "SBR-1 Inlet Valve", group: "sbr", type: "valve", loc: "main" },
  SBR2_INLET: { name: "SBR-2 Inlet Valve", group: "sbr", type: "valve", loc: "main" },
  BLOWER1:    { name: "SBR Blower 1", group: "sbr", type: "blower", loc: "main" },
  BLOWER2:    { name: "SBR Blower 2", group: "sbr", type: "blower", loc: "main" },
  BLOWER3:    { name: "SBR Blower 3", group: "sbr", type: "blower", loc: "main" },
  BLOWER4:    { name: "SBR Blower 4", group: "sbr", type: "blower", loc: "main" },
  AIR1:       { name: "SBR-1 Air Inlet Line", group: "sbr", type: "valve", loc: "main" },
  AIR2:       { name: "SBR-2 Air Inlet Line", group: "sbr", type: "valve", loc: "main" },
  DECANTER:   { name: "SBR Decanter", group: "sbr", type: "decanter", loc: "main" },
  RECIRC_A1:  { name: "Re-Circulation Pump A1", group: "sbr", type: "pump", loc: "BASIN1" },
  RECIRC_A2:  { name: "Re-Circulation Pump A2", group: "sbr", type: "pump", loc: "BASIN1" },
  SLUDGE_A1:  { name: "Sludge Sump Pump A1", group: "sbr", type: "pump", loc: "BASIN1" },
  SLUDGE_A2:  { name: "Sludge Sump Pump A2", group: "sbr", type: "pump", loc: "BASIN1" },
  RECIRC_B1:  { name: "Re-Circulation Pump B1", group: "sbr", type: "pump", loc: "BASIN2" },
  RECIRC_B2:  { name: "Re-Circulation Pump B2", group: "sbr", type: "pump", loc: "BASIN2" },
  SLUDGE_B1:  { name: "Sludge Sump Pump B1", group: "sbr", type: "pump", loc: "BASIN2" },
  SLUDGE_B2:  { name: "Sludge Sump Pump B2", group: "sbr", type: "pump", loc: "BASIN2" },
};
Object.values(DEVICES).forEach(d => { d.on = false; d.mode = "local"; });
DEVICES.AIR1.on = true; DEVICES.RECIRC_A1.on = true; DEVICES.BLOWER1.on = true;

// ---------- Interlocks ----------
function checkInterlock(id, nextOn) {
  if (!nextOn) return null;
  if (id.startsWith("BLOWER")) {
    if (!DEVICES.AIR1.on && !DEVICES.AIR2.on)
      return "Blocked: at least one Air Inlet Line valve (AIR-1 or AIR-2) must be open.";
    if (DEVICES.DECANTER.on)
      return "Blocked: Decanter is ON. Blowers cannot run while decanter is active.";
  }
  if (id === "SBR1_INLET" && DEVICES.DECANTER.on)
    return "Blocked: Decanter is ON. Inlet valve cannot open during decant.";
  return null;
}

// ---------- Remote state ----------
let remoteActive = false;
let remoteTimerId = null;
let remoteEndsAt = null;
let selectedSection = null; // 'sbr' or null
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ---------- Engineering view rendering ----------
function renderEngDevice(devEl) {
  const id = devEl.dataset.id;
  const d = DEVICES[id];
  const controls = devEl.querySelector(".dev-controls");
  controls.innerHTML = "";
  const pill = document.createElement("span");
  pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
  pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
  controls.appendChild(pill);
  const lab = document.createElement("label");
  lab.className = "switch";
  const inp = document.createElement("input");
  inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
  inp.addEventListener("change", e => attemptToggle(id, e.target.checked, devEl));
  const sl = document.createElement("span"); sl.className = "slider";
  lab.append(inp, sl); controls.appendChild(lab);
  devEl.classList.toggle("on", d.on);
}

function renderEngTankInternals(tankId) {
  const host = document.querySelector(`.tank-internals[data-tank-internals="${tankId}"]`);
  if (!host) return;
  host.innerHTML = "";
  Object.entries(DEVICES).filter(([,d]) => d.loc === tankId).forEach(([id, d]) => {
    const el = document.createElement("div");
    el.className = "mini-device" + (d.on ? " on" : "");
    el.dataset.id = id;
    el.innerHTML = `
      <div class="mini-icon">⏣</div>
      <div class="mini-name">${d.name}</div>
      <div class="mini-controls"></div>`;
    host.appendChild(el);
    const ctrls = el.querySelector(".mini-controls");
    const pill = document.createElement("span");
    pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
    pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
    ctrls.appendChild(pill);
    const lab = document.createElement("label"); lab.className = "switch";
    const inp = document.createElement("input");
    inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
    inp.style.marginLeft = "8px";
    inp.addEventListener("change", e => attemptToggle(id, e.target.checked, el));
    const sl = document.createElement("span"); sl.className = "slider";
    lab.append(inp, sl); ctrls.appendChild(lab);
  });
}

// =====================================================================
// JSON-driven Plant Layout renderer (consumes JointJS-format cells)
// =====================================================================

// Map JointJS equipment labels -> our DEVICES ids (for remote control wiring)
const LABEL_TO_DEVICE = {
  "SBR 1 Inlet Valve": "SBR1_INLET",
  "SBR 2 Inlet Valve": "SBR2_INLET",
  "SBR 1 Air Inlet Line": "AIR1",
  "SBR 2 Air Inlet Line": "AIR2",
  "Re-Circulation Pump - A1": "RECIRC_A1",
  "Re-Circulation Pump - A2": "RECIRC_A2",
  "Sludge Sump Pump - A1": "SLUDGE_A1",
  "Sludge Sump Pump - A2": "SLUDGE_A2",
  "Re-Circulation Pump - B1": "RECIRC_B1",
  "Re-Circulation Pump - B2": "RECIRC_B2",
  "Sludge Sump Pump - B1": "SLUDGE_B1",
  "Sludge Sump Pump - B2": "SLUDGE_B2",
  // Decanter not present in SBR section JSON; keep DECANTER virtual
};

let LAYOUT = null;     // { cells, idIndex, bbox, viewBox, blowerOrderIds }
let CELL_BY_ID = {};

// Sections registry — only 'sbr' is wired in this prototype
const SECTIONS = [
  { id: "sbr",        name: "SBR Cycle",         sub: "17 equipment · 2 basins · interlocked",     real: true },
  { id: "sludge",     name: "Sludge Handling",   sub: "Thickeners · Centrifuges · Disposal pit",   real: false },
  { id: "dosing",     name: "Chemical Dosing",   sub: "DWPE · FeCl3 · NaOCl pumps",                real: false },
  { id: "uf",         name: "UF Filtration",     sub: "3 UF skids · CIP cycle",                    real: false },
  { id: "ro",         name: "RO System",         sub: "HP pumps · 2 RO trains",                    real: false },
  { id: "inlet",      name: "Inlet & Screening", sub: "Coarse screen · Grit chamber",              real: false },
];

// SBR section bbox in JointJS coordinates (used for dim-mode hit-testing)
const SBR_BBOX = (window.SBR_BBOX) || { minX:1500, minY:-1100, maxX:3700, maxY:1200 };
function isCellInSbr(c) {
  if (!c.position) return false;
  const x = c.position.x, y = c.position.y;
  const w = c.size?.width||0, h = c.size?.height||0;
  return (x + w >= SBR_BBOX.minX) && (x <= SBR_BBOX.maxX)
      && (y + h >= SBR_BBOX.minY) && (y <= SBR_BBOX.maxY);
}

function loadLayout() {
  const cells = (window.SBR_CELLS || []).slice();
  const elements = cells.filter(c => c.type !== "Pipe" && c.type !== "standard.Link" && c.position);
  const links    = cells.filter(c => c.type === "Pipe" || c.type === "standard.Link");

  // Index by id
  const idx = {};
  for (const c of cells) if (c.id) idx[c.id] = c;

  // Bounding box of elements
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const c of elements) {
    const x = c.position.x, y = c.position.y;
    const w = c.size?.width||0, h = c.size?.height||0;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x+w > maxX) maxX = x+w; if (y+h > maxY) maxY = y+h;
  }
  // Padding
  const pad = 80;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;

  // Order blowers (BLW) top-to-bottom so we can map them to BLOWER1..4
  const blowers = elements.filter(c => c.type === "BLW").sort((a,b) => a.position.y - b.position.y);

  LAYOUT = {
    cells, elements, links, idx,
    bbox: { minX, minY, maxX, maxY, w: maxX-minX, h: maxY-minY },
    blowerOrderIds: blowers.map(b => b.id)
  };
  CELL_BY_ID = idx;
}

// Resolve a cell -> our DEVICES id (or null)
function cellDeviceId(cell) {
  const lbl = cell.attrs?.label?.text?.trim();
  if (lbl && LABEL_TO_DEVICE[lbl]) return LABEL_TO_DEVICE[lbl];
  if (cell.type === "BLW") {
    const i = LAYOUT.blowerOrderIds.indexOf(cell.id);
    if (i >= 0) return `BLOWER${i+1}`;
  }
  if (cell.type === "SBR_TANK") {
    // Two SBR_TANK cells; first one (lower y) = BASIN1, second = BASIN2
    const tanks = LAYOUT.elements.filter(c => c.type === "SBR_TANK").sort((a,b)=>a.position.y-b.position.y);
    return tanks[0]?.id === cell.id ? "BASIN1" : "BASIN2";
  }
  return null;
}

// ---------- Per-type SVG drawers ----------
function elGroup(c, klass) {
  const g = svgEl("g", { class: klass, "data-cell-id": c.id });
  const cx = c.position.x + (c.size?.width||0)/2;
  const cy = c.position.y + (c.size?.height||0)/2;
  if (c.angle) g.setAttribute("transform", `translate(${c.position.x},${c.position.y}) rotate(${c.angle} ${(c.size?.width||0)/2} ${(c.size?.height||0)/2})`);
  else g.setAttribute("transform", `translate(${c.position.x},${c.position.y})`);
  return g;
}

function drawSbrTank(c) {
  const g = elGroup(c, "lay-sbr-tank clickable-tank");
  const w = c.size.width, h = c.size.height;
  // tank wall
  g.appendChild(svgEl("rect", { x:0, y:0, width:w, height:h, fill:"#9ec6f5", stroke:"#23344e", "stroke-width":3, class:"tank-wall" }));
  // water with level (level = % from JSON)
  const lvl = (c.level ?? 60) / 100;
  const wh = h * lvl;
  g.appendChild(svgEl("rect", { x:2, y:h-wh, width:w-4, height:wh, fill:"#5e9bd8", opacity:.85 }));
  g.appendChild(svgEl("rect", { x:2, y:h-wh, width:w-4, height:6, fill:"#cfe6ff", opacity:.6 }));
  // diffuser bar at floor (Zone-3)
  g.appendChild(svgEl("rect", { x:20, y:h-22, width:w-40, height:6, fill:"#5a3aae" }));
  // floor bubble row
  for (let i=0;i<14;i++){
    g.appendChild(svgEl("circle", { cx:30+i*((w-60)/13), cy:h-30-((i%3)*8), r:3, fill:"#7c5cff", opacity:.7 }));
  }

  // === RISING BUBBLES (constant motion = "alive" tank) ===
  const bubbles = svgEl("g", { class: "tank-bubbles" });
  for (let i=0;i<10;i++){
    const bx = w*(0.55) + (i%4) * (w*0.10);
    const delay = (i * 0.45).toFixed(2);
    const b = svgEl("circle", { cx:bx, cy:h-20, r: 2 + (i%3), fill:"#9ad0ff", opacity:0 });
    b.style.animation = `tankBubble 3.6s ${delay}s linear infinite`;
    b.style.transformOrigin = `${bx}px ${h-20}px`;
    b.style.transformBox = "fill-box";
    bubbles.appendChild(b);
  }
  g.appendChild(bubbles);

  // === PEEK / X-RAY LAYER (always visible at 55% — no hover) ===
  const peek = svgEl("g", { class: "peek-layer" });
  // Dashed cutaway "window" on the right (Zone-3 area where pumps live)
  const px0 = w*0.50, py0 = h*0.42, pw = w*0.45, ph = h*0.48;
  peek.appendChild(svgEl("rect", { x:px0, y:py0, width:pw, height:ph, rx:10, fill:"rgba(15,20,32,.18)", stroke:"#7c5cff", "stroke-dasharray":"7 5", "stroke-width":2.5 }));
  // 4 ghost pump silhouettes
  for (let i=0;i<4;i++){
    const cx = px0 + pw * (0.18 + i*0.22);
    const cy = py0 + ph * 0.55;
    const pgh = svgEl("g");
    pgh.appendChild(svgEl("circle", { cx, cy, r: 18, fill:"rgba(255,255,255,.45)", stroke:"#7c5cff", "stroke-width":1.5 }));
    pgh.appendChild(svgEl("circle", { cx, cy, r: 9, fill:"#7c5cff", opacity:.55 }));
    // mini blades
    const blades = svgEl("g");
    blades.setAttribute("transform", `translate(${cx},${cy})`);
    blades.style.transformOrigin = "0 0";
    blades.style.animation = `spin 1.6s linear infinite`;
    for (let b=0;b<3;b++){
      const blade = svgEl("path", { d: "M0,-8 L3,-1 L-3,-1 Z", fill:"#fff" });
      blade.setAttribute("transform", `rotate(${b*120})`);
      blades.appendChild(blade);
    }
    pgh.appendChild(blades);
    peek.appendChild(pgh);
  }
  // little "viewfinder" corner brackets
  const cornerLen = 14;
  [[px0,py0,1,1],[px0+pw,py0,-1,1],[px0,py0+ph,1,-1],[px0+pw,py0+ph,-1,-1]].forEach(([x,y,sx,sy]) => {
    peek.appendChild(svgEl("path", { d: `M ${x} ${y+sy*cornerLen} L ${x} ${y} L ${x+sx*cornerLen} ${y}`, stroke:"#7c5cff", "stroke-width":3, fill:"none", "stroke-linecap":"round" }));
  });
  g.appendChild(peek);

  // === STACKED-CARD EDGES (sustained "this contains items" cue) ===
  // Two thin layered edges peek out from behind the tank's top-right corner
  const stackG = svgEl("g", { class:"stacked-edge" });
  stackG.appendChild(svgEl("rect", { x: 12, y: -12, width: w-24, height: 8, rx: 3, fill: "#bcd0ee", stroke:"#3a4a7a", "stroke-width":1 }));
  stackG.appendChild(svgEl("rect", { x: 6,  y: -6,  width: w-12, height: 8, rx: 3, fill: "#dfe8f6", stroke:"#3a4a7a", "stroke-width":1 }));
  g.insertBefore(stackG, g.firstChild);

  // === DOUBLE-CLICK badge (top-right) — sustained, blinking ===
  const dbl = svgEl("g", { class:"dbl-badge" });
  dbl.appendChild(svgEl("rect", { x: w-180, y: 8, width: 172, height: 26, rx: 13, fill:"#0d2240", stroke:"#7cc4ff", "stroke-width":1.5 }));
  // two tiny click rings to signify double tap
  dbl.appendChild(svgEl("circle", { cx: w-165, cy: 21, r: 4, fill:"none", stroke:"#7cc4ff", "stroke-width":1.5 }));
  dbl.appendChild(svgEl("circle", { cx: w-156, cy: 21, r: 4, fill:"none", stroke:"#7cc4ff", "stroke-width":1.5 }));
  const dt = svgEl("text", { x: w-138, y: 25, "font-size":11, fill:"#cfe3ff", "font-weight":"700", "letter-spacing":".8" });
  dt.textContent = "DBL-CLICK TO ENTER";
  dbl.appendChild(dt);
  g.appendChild(dbl);

  // === Subtle bottom info chip (no action verb — info only) ===
  const info = svgEl("g", { class: "inspect-badge" });
  const iy = h - 30;
  info.appendChild(svgEl("rect", { x: 14, y: iy, width: 200, height: 22, rx: 11, fill: "rgba(13,34,64,.85)", stroke:"#3a4a7a", "stroke-width":1 }));
  const il = svgEl("text", { x: 24, y: iy+15, "font-size": 11, fill: "#9fc8ff", "font-weight":"600" });
  il.textContent = "⊞ Contains 4 nested pumps";
  info.appendChild(il);
  g.appendChild(info);

  // label
  const t = svgEl("text", { x:w/2, y:24, "text-anchor":"middle", "font-size":18, fill:"#0d2240", "font-weight":"700" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);

  // === Double-click handler -> drill in (single click reserved for select/info) ===
  const tanks = LAYOUT.elements.filter(x => x.type === "SBR_TANK").sort((a,b)=>a.position.y-b.position.y);
  const basinId = tanks[0]?.id === c.id ? "BASIN1" : "BASIN2";
  g.addEventListener("dblclick", e => { e.stopPropagation(); toggleTankExpand(basinId); });
  // Single click: hint
  let clickT;
  g.addEventListener("click", e => {
    e.stopPropagation();
    clearTimeout(clickT);
    clickT = setTimeout(() => toast(`Double-click ${basinId === "BASIN1" ? "Basin 1" : "Basin 2"} to view its 4 pumps`, "warn"), 220);
  });
  g.addEventListener("dblclick", () => clearTimeout(clickT));

  return g;
}

function drawOsTank(c, isDf) {
  const g = elGroup(c, "lay-os-tank");
  const w = c.size.width, h = c.size.height;
  g.appendChild(svgEl("rect", { x:0, y:0, width:w, height:h, fill: isDf ? "#9ec6f5" : "#cfdaeb", stroke:"#23344e", "stroke-width":3 }));
  const lvl = 0.6;
  g.appendChild(svgEl("rect", { x:2, y:h*(1-lvl), width:w-4, height:h*lvl-2, fill:"#5e9bd8", opacity:.85 }));
  if (isDf) {
    // diffuser pattern
    for (let i=0;i<10;i++){
      g.appendChild(svgEl("circle", { cx:20+i*((w-40)/9), cy:h-20, r:2.5, fill:"#7c5cff" }));
    }
  }
  const t = svgEl("text", { x:w/2, y:24, "text-anchor":"middle", "font-size":16, fill:"#0d2240", "font-weight":"700" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

function drawValve(c) {
  const g = elGroup(c, "lay-valve");
  const w = c.size.width, h = c.size.height;
  // pipe ends
  g.appendChild(svgEl("rect", { x:-12, y:h*.35, width:w+24, height:h*.30, fill:"#9aa6c0", stroke:"#3a3a3a", "stroke-width":1.2 }));
  // body
  const dev = cellDeviceId(c);
  const on = dev && DEVICES[dev]?.on;
  g.appendChild(svgEl("rect", { x:w*.12, y:h*.12, width:w*.76, height:h*.76, fill: on ? "#22a043" : "#c92626", stroke:"#101010", "stroke-width":1.5, class:"valve-body" }));
  // handle
  g.appendChild(svgEl("rect", { x:w/2-2, y:-h*.28, width:4, height:h*.4, fill:"#3a3a3a" }));
  g.appendChild(svgEl("circle", { cx:w/2, cy:-h*.28, r:5, fill:"#3a3a3a" }));
  // label below
  const t = svgEl("text", { x:w/2, y:h+18, "text-anchor":"middle", "font-size":12, fill:"#0d2240" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

function drawBlower(c) {
  const dev = cellDeviceId(c);
  const on = dev && DEVICES[dev]?.on;
  const g = elGroup(c, "lay-blower" + (on ? " on" : ""));
  const w = c.size.width, h = c.size.height;
  // Outer chassis body (light, like screenshot)
  g.appendChild(svgEl("rect", { x:0, y:0, width:w, height:h, rx:6, fill:"#e8eef6", stroke:"#23344e", "stroke-width":2, class:"blower-body" }));
  // Inner darker frame (motor housing)
  g.appendChild(svgEl("rect", { x:6, y:6, width:w-12, height:h-12, rx:4, fill:"none", stroke:"#7892ad", "stroke-width":1, "stroke-dasharray":"3 3" }));
  // Cooling-fin stripes on body (industrial detail)
  for (let i=0;i<5;i++){
    const fy = 14 + i*(h-28)/5;
    g.appendChild(svgEl("line", { x1:14, y1:fy, x2:w-14, y2:fy, stroke:"#9aa6c0", "stroke-width":1, opacity:.55 }));
  }
  // LED status (top-left)
  g.appendChild(svgEl("rect", { x:10, y:10, width:14, height:14, rx:2, fill:"#1a1a1a", stroke:"#3a3a3a" }));
  g.appendChild(svgEl("circle", { cx:17, cy:17, r:5, class:"blower-led", fill:"#c92626" }));
  // Airflow nozzle (right side, where pipe attaches in JointJS)
  const noz = svgEl("g");
  noz.appendChild(svgEl("path", { d:`M ${w-18} ${h*.4} L ${w} ${h*.5} L ${w-18} ${h*.6} Z`, fill:"#7892ad", stroke:"#23344e", "stroke-width":1.2 }));
  g.appendChild(noz);
  // Airflow lines emanating to the right (animated when ON)
  const flow = svgEl("g", { class:"airflow" });
  for (let i=0;i<3;i++){
    flow.appendChild(svgEl("path", {
      d:`M ${w+2} ${h*.5 - 14 + i*14} q 16 -6 32 0 t 32 0`,
      fill:"none", stroke:"#22c55e", "stroke-width":2, "stroke-linecap":"round"
    }));
  }
  g.appendChild(flow);
  // Equipment tag plate (centered, "BLW")
  const tagW = 36, tagH = 14;
  g.appendChild(svgEl("rect", { x:w/2-tagW/2, y:h/2-tagH/2, width:tagW, height:tagH, rx:2, fill:"#1c2742", stroke:"#3e4b73" }));
  const tag = svgEl("text", { x:w/2, y:h/2+4, "text-anchor":"middle", "font-size":10, fill:"#9fc8ff", "font-weight":"700", "font-family":"monospace" });
  tag.textContent = "BLW";
  g.appendChild(tag);
  return g;
}

function drawSubPmp(c) {
  const g = elGroup(c, "lay-sub-pmp");
  const w = c.size.width, h = c.size.height;
  const dev = cellDeviceId(c);
  const on = dev && DEVICES[dev]?.on;
  // submersible: vertical body with impeller at top, riser pipe
  const cx = w/2;
  // riser pipe up
  g.appendChild(svgEl("rect", { x:cx-8, y:0, width:16, height:h*0.45, fill:"#9aa6c0", stroke:"#3a3a3a" }));
  // motor body
  g.appendChild(svgEl("rect", { x:cx-30, y:h*0.45, width:60, height:h*0.30, rx:8, fill:"#1a1a1a", stroke:"#000" }));
  // impeller housing
  g.appendChild(svgEl("circle", { cx, cy:h*0.85, r: Math.min(w,h)*0.18, fill: on ? "#22a043" : "#c92626", stroke:"#101010", "stroke-width":2 }));
  // blades
  const fan = svgEl("g", { class:"fan", style: on ? "transform-origin:center;transform-box:fill-box;animation:spin .9s linear infinite" : "" });
  fan.setAttribute("transform", `translate(${cx},${h*0.85})`);
  const r = Math.min(w,h)*0.16;
  for (let i=0;i<3;i++){
    const blade = svgEl("path", { d:`M0,-${r} L${r*.3},-${r*.2} L-${r*.3},-${r*.2} Z`, fill:"#fff" });
    blade.setAttribute("transform", `rotate(${i*120})`);
    fan.appendChild(blade);
  }
  fan.appendChild(svgEl("circle", { r:5, fill:"#101010" }));
  g.appendChild(fan);
  // label
  const t = svgEl("text", { x:w/2, y:h+18, "text-anchor":"middle", "font-size":13, fill:"#0d2240" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

function drawLevelSensor(c) {
  const g = elGroup(c, "lay-level");
  const w = c.size.width, h = c.size.height;
  const lvl = (c.level ?? 50) / 100;
  // frame
  g.appendChild(svgEl("rect", { x:w*.15, y:8, width:w*.45, height:h-16, fill:"#0f1626", stroke:"#3b4d70" }));
  // fill from bottom
  const fillH = (h-16)*lvl;
  g.appendChild(svgEl("rect", { x:w*.17, y:h-8-fillH, width:w*.41, height:fillH, fill: c.liquidColor || "#1f8a3a" }));
  // tick marks + numbers
  const ticks = 10;
  for (let i=0;i<=ticks;i++){
    const ty = 8 + (h-16) * (i/ticks);
    g.appendChild(svgEl("line", { x1:w*.62, y1:ty, x2:w*.70, y2:ty, stroke:"#0d2240", "stroke-width":1 }));
    const t = svgEl("text", { x:w*.74, y:ty+4, "font-size":9, fill:"#0d2240" });
    t.textContent = String(100 - i*10);
    g.appendChild(t);
  }
  const t = svgEl("text", { x:w/2, y:h-2+18, "text-anchor":"middle", "font-size":12, fill:"#0d2240", "font-weight":"700" });
  t.textContent = c.attrs?.label?.text || "Level";
  g.appendChild(t);
  return g;
}

function drawNumberSensor(c) {
  const g = elGroup(c, "lay-num");
  const w = c.size.width, h = c.size.height;
  const lbl = svgEl("text", { x:w/2, y:14, "text-anchor":"middle", "font-size":11, fill:"#0d2240" });
  lbl.textContent = c.attrs?.label?.text || "";
  g.appendChild(lbl);
  g.appendChild(svgEl("rect", { x:6, y:22, width:w-12, height:h-30, fill:"#0f1626", stroke:"#3a4a7a" }));
  const v = svgEl("text", { x:w/2, y:h-12, "text-anchor":"middle", "font-size":18, fill:"#fff", "font-weight":"700" });
  v.textContent = (c.value ?? 0).toString();
  g.appendChild(v);
  return g;
}

function drawSwitchSensor(c) {
  const g = elGroup(c, "lay-switch");
  const w = c.size.width, h = c.size.height;
  // Red square (matching screenshot's ON/OFF tile)
  g.appendChild(svgEl("rect", { x:w*.15, y:6, width:w*.7, height:w*.7, fill:"#c92626", stroke:"#7a0e0e", "stroke-width":1.5 }));
  g.appendChild(svgEl("circle", { cx:w/2, cy:6+w*.35, r:5, fill:"#fff" }));
  const t = svgEl("text", { x:w/2, y:h-4, "text-anchor":"middle", "font-size":10, fill:"#0d2240", "font-weight":"700" });
  t.textContent = c.attrs?.label?.text || "ON/OFF";
  g.appendChild(t);
  return g;
}

function drawZone(c) {
  const g = elGroup(c, "lay-zone");
  const w = c.size.width, h = c.size.height;
  // arrow chip showing flow direction
  g.appendChild(svgEl("path", { d:`M0,${h/2} L${w*.8},${h/2} L${w*.8},2 L${w},${h/2} L${w*.8},${h-2} L${w*.8},${h/2}`, fill:"#cfe3ff", stroke:"#3a4a7a" }));
  const t = svgEl("text", { x:w/2-4, y:h/2+4, "text-anchor":"middle", "font-size":10, fill:"#0d2240" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

function drawJoins(c) {
  const g = elGroup(c, "lay-join");
  const w = c.size.width, h = c.size.height;
  g.appendChild(svgEl("circle", { cx:w/2, cy:h/2, r:Math.min(w,h)/2-2, fill:"#fff", stroke:"#3a4a7a", "stroke-width":1.5 }));
  const t = svgEl("text", { x:w/2, y:h/2+3, "text-anchor":"middle", "font-size":9, fill:"#0d2240" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

function drawLabelWidget(c) {
  const g = elGroup(c, "lay-label");
  const w = c.size.width, h = c.size.height;
  const t = svgEl("text", { x:w/2, y:h/2+5, "text-anchor":"middle", "font-size":14, fill:"#0d2240", "font-weight":"700" });
  t.textContent = c.attrs?.label?.text || "";
  g.appendChild(t);
  return g;
}

const TYPE_DRAWERS = {
  SBR_TANK: drawSbrTank,
  OS_TANK: c => drawOsTank(c, false),
  OS_TANK_DF: c => drawOsTank(c, true),
  VALVE_2: drawValve,
  BLW: drawBlower,
  SUB_PMP: drawSubPmp,
  PMP: drawSubPmp,
  LEVEL_SENSOR: drawLevelSensor,
  NUMBER_SENSOR: drawNumberSensor,
  SWITCH_SENSOR: drawSwitchSensor,
  ZONE: drawZone,
  JOINS: drawJoins,
  LABEL_WIDGET: drawLabelWidget,
};

function cellCenter(cell) {
  if (!cell || !cell.position) return null;
  return { x: cell.position.x + (cell.size?.width||0)/2, y: cell.position.y + (cell.size?.height||0)/2 };
}

function drawPipe(p) {
  const src = CELL_BY_ID[p.source?.id];
  const tgt = CELL_BY_ID[p.target?.id];
  if (!src || !tgt) return null;
  const a = cellCenter(src), b = cellCenter(tgt);
  if (!a || !b) return null;
  const verts = (p.vertices || []).map(v => `${v.x},${v.y}`);
  const pts = [`${a.x},${a.y}`, ...verts, `${b.x},${b.y}`];
  const g = svgEl("g", { class: "lay-pipe", "data-pipe-ends": `${p.source.id}|${p.target.id}` });
  g.appendChild(svgEl("polyline", { points: pts.join(" "), fill:"none", stroke:"#7e96b3", "stroke-width":8, "stroke-linejoin":"miter", "stroke-linecap":"butt" }));
  g.appendChild(svgEl("polyline", { points: pts.join(" "), fill:"none", stroke: p.liquidColor || "#cfd8ee", "stroke-width":4, "stroke-linejoin":"miter", "stroke-linecap":"butt", opacity:.9 }));
  return g;
}

// Renders the layout into a host element. interactive=false skips click handlers / badges.
function renderLayoutInto(hostId, interactive) {
  if (!LAYOUT) loadLayout();
  const host = document.getElementById(hostId);
  if (!host || !LAYOUT) return;
  host.innerHTML = "";
  const { bbox, elements, links } = LAYOUT;
  const svg = svgEl("svg", {
    class: "layout-svg" + (interactive ? "" : " non-interactive"),
    viewBox: `${bbox.minX} ${bbox.minY} ${bbox.w} ${bbox.h}`,
    preserveAspectRatio: "xMidYMid meet"
  });
  host.appendChild(svg);
  const layerPipes = svgEl("g", { class:"layer-pipes" });
  const layerBack  = svgEl("g", { class:"layer-back"  });
  const layerEquip = svgEl("g", { class:"layer-equip" });
  const layerText  = svgEl("g", { class:"layer-text"  });
  svg.append(layerPipes, layerBack, layerEquip, layerText);
  for (const p of links) { const el = drawPipe(p); if (el) layerPipes.appendChild(el); }
  for (const c of elements) {
    const drawer = TYPE_DRAWERS[c.type];
    if (!drawer) continue;
    const node = drawer(c);
    if (!node) continue;
    if (!interactive) {
      // Disable interactivity on Layout B (reference)
      node.style.pointerEvents = "none";
      // Strip badges/ribbons from non-interactive copy so it looks "clean"
      node.querySelectorAll(".inspect-badge, .corner-ribbon").forEach(n => n.remove());
    }
    if (c.type === "SBR_TANK" || c.type === "OS_TANK" || c.type === "OS_TANK_DF") layerBack.appendChild(node);
    else if (c.type === "LABEL_WIDGET" || c.type === "NUMBER_SENSOR") layerText.appendChild(node);
    else layerEquip.appendChild(node);
  }
}

function renderLayout() {
  renderLayoutInto("layoutHost", true);
  installZoomPan();
  positionTankExpands();
  positionOverlays();
  applyDimMode("scadaWrap", selectedSection === "sbr");
  // After render, frame the right viewBox (full or section)
  applyViewBoxForSelection(false);
}

function positionTankExpands() {
  const wrap = document.getElementById("scadaWrap");
  const svg = wrap.querySelector(".layout-svg");
  if (!wrap || !svg) return;
  const tanks = LAYOUT.elements.filter(c => c.type === "SBR_TANK").sort((a,b)=>a.position.y-b.position.y);
  const wrapRect = wrap.getBoundingClientRect();
  for (let i=0;i<tanks.length;i++){
    const c = tanks[i];
    const node = svg.querySelector(`g[data-cell-id="${c.id}"]`);
    const btn = document.getElementById(`tankExpand${i+1}`);
    if (!node || !btn) continue;
    const bb = node.getBoundingClientRect();
    btn.style.left = (bb.left - wrapRect.left + bb.width/2) + "px";
    btn.style.top  = (bb.top - wrapRect.top + 8) + "px";
    btn.style.transform = "translateX(-50%)";
  }
}
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs={}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function drawPumpSvg(g, on) {
  g.innerHTML = "";
  g.classList.toggle("on", on);
  // motor housing
  g.appendChild(svgEl("circle", { r: 22, class: "ring" }));
  // colored body
  g.appendChild(svgEl("circle", { r: 18, class: "body" }));
  // 3-blade impeller
  const imp = svgEl("g", { class: "impeller" });
  imp.appendChild(svgEl("path", { d: "M0,-14 L4,-3 L-4,-3 Z", class: "blade" }));
  imp.appendChild(svgEl("path", { d: "M12,7 L1,3 L4,14 Z", class: "blade" }));
  imp.appendChild(svgEl("path", { d: "M-12,7 L-1,3 L-4,14 Z", class: "blade" }));
  g.appendChild(imp);
  g.appendChild(svgEl("circle", { r: 3, class: "hub" }));
}

function drawValveSvg(g, on, isAir) {
  g.innerHTML = "";
  g.classList.toggle("on", on);
  if (isAir) g.classList.add("air");
  // pipe ends
  g.appendChild(svgEl("rect", { x: -28, y: -6, width: 56, height: 12, class: "pipe" }));
  // body (square)
  g.appendChild(svgEl("rect", { x: -13, y: -13, width: 26, height: 26, class: "body" }));
  // handle
  g.appendChild(svgEl("rect", { x: -2, y: -28, width: 4, height: 14, class: "handle" }));
  g.appendChild(svgEl("circle", { cx: 0, cy: -28, r: 3.5, class: "handle" }));
}

function drawBlowerSvg(g, on, idx) {
  g.innerHTML = "";
  g.classList.toggle("on", on);
  // ON/OFF indicator tile (red/green like screenshot)
  g.appendChild(svgEl("rect", { x: 0, y: 0, width: 22, height: 22, class: "indicator" }));
  const dot = svgEl("circle", { cx: 11, cy: 11, r: 3.5, class: "indicator-dot" });
  g.appendChild(dot);
  const onoff = svgEl("text", { x: 11, y: 36, "text-anchor": "middle" });
  onoff.textContent = "ON/OFF";
  g.appendChild(onoff);
  // Blower body box
  g.appendChild(svgEl("rect", { x: 32, y: 0, width: 130, height: 32, class: "box" }));
  const lbl = svgEl("text", { x: 97, y: 20, "text-anchor": "middle" });
  lbl.textContent = `SBR Blower - ${idx}`;
  g.appendChild(lbl);
}

function drawDecanterSvg(g, on) {
  g.innerHTML = "";
  g.classList.toggle("on", on);
  g.appendChild(svgEl("rect", { x: -22, y: -14, width: 44, height: 28, rx: 4, class: "body" }));
  const t = svgEl("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 16 });
  t.textContent = "⇊";
  t.setAttribute("fill", "#1a2236");
  g.appendChild(t);
  const lbl = svgEl("text", { x: 0, y: 28, "text-anchor": "middle", "font-size": 10, fill: "#1a2236" });
  lbl.textContent = "Decanter";
  g.appendChild(lbl);
}

function renderScada() {
  // Re-render the JSON-driven layout so device on/off state propagates
  renderLayout();
}

// ---------- HTML overlay controls anchored over SVG devices ----------
const ANCHORS = {
  // id : { offsetY : px below the bbox center for control tooltip }
  SBR1_INLET:{}, SBR2_INLET:{}, AIR1:{}, AIR2:{},
  BLOWER1:{}, BLOWER2:{}, BLOWER3:{}, BLOWER4:{},
  DECANTER:{}, RECIRC_A1:{}, RECIRC_A2:{}, SLUDGE_A1:{}, SLUDGE_A2:{},
  RECIRC_B1:{}, RECIRC_B2:{}, SLUDGE_B1:{}, SLUDGE_B2:{}
};

function positionOverlays() {
  const wrap = document.getElementById("scadaWrap");
  if (!wrap || !LAYOUT) return;
  const svg = wrap.querySelector(".layout-svg");
  if (!svg) return;
  // Ensure overlay layer exists
  let layer = wrap.querySelector(".overlay-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "overlay-layer";
    wrap.appendChild(layer);
  }
  const wrapRect = wrap.getBoundingClientRect();
  const seen = new Set();

  // Walk every interactive cell and place its overlay
  for (const c of LAYOUT.elements) {
    const devId = cellDeviceId(c);
    if (!devId || !DEVICES[devId]) continue;
    if (DEVICES[devId].loc !== "main") continue; // tank-internals are in the drawer
    seen.add(devId);
    const node = svg.querySelector(`g[data-cell-id="${c.id}"]`);
    if (!node) continue;
    const bb = node.getBoundingClientRect();
    const cx = bb.left - wrapRect.left + bb.width / 2;
    const cy = bb.bottom - wrapRect.top + 6;

    let ctl = layer.querySelector(`.ctl[data-id="${devId}"]`);
    if (!ctl) {
      ctl = document.createElement("div");
      ctl.className = "ctl";
      ctl.dataset.id = devId;
      layer.appendChild(ctl);
    }
    ctl.style.left = cx + "px";
    ctl.style.top  = cy + "px";

    const d = DEVICES[devId];
    ctl.innerHTML = "";
    const pill = document.createElement("span");
    pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
    pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
    ctl.appendChild(pill);
    const lab = document.createElement("label"); lab.className = "switch";
    const inp = document.createElement("input");
    inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
    inp.addEventListener("change", e => attemptToggle(devId, e.target.checked, ctl));
    const sl = document.createElement("span"); sl.className = "slider";
    lab.append(inp, sl); ctl.appendChild(lab);
  }
  // Remove orphaned overlays
  layer.querySelectorAll(".ctl").forEach(c => { if (!seen.has(c.dataset.id)) c.remove(); });

  positionTankExpands();
}

function renderVizTankInternals(tankId) {
  const host = document.querySelector(`[data-viz-internals="${tankId}"]`);
  if (!host) return;
  host.innerHTML = `<div class="tank-drawer-head"><span>Pumps inside ${tankId === "BASIN1" ? "CASS Basin 1" : "CASS Basin 2"}</span><button class="link" data-collapse="${tankId}">✕ Close</button></div>`;
  Object.entries(DEVICES).filter(([,d]) => d.loc === tankId).forEach(([id, d]) => {
    const el = document.createElement("div");
    el.className = "mini-device" + (d.on ? " on" : "");
    el.dataset.id = id;
    el.innerHTML = `<div class="mini-icon">⏣</div><div class="mini-name">${d.name}</div><div class="mini-controls"></div>`;
    host.appendChild(el);
    const ctrls = el.querySelector(".mini-controls");
    const pill = document.createElement("span");
    pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
    pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
    ctrls.appendChild(pill);
    const lab = document.createElement("label"); lab.className = "switch";
    const inp = document.createElement("input");
    inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
    inp.style.marginLeft = "8px";
    inp.addEventListener("change", e => attemptToggle(id, e.target.checked, el));
    const sl = document.createElement("span"); sl.className = "slider";
    lab.append(inp, sl); ctrls.appendChild(lab);
  });
  host.querySelector("[data-collapse]")?.addEventListener("click", () => toggleTankExpand(tankId));
}

function renderAll() {
  // Engineering devices
  $$("#view-engineering .device").forEach(renderEngDevice);
  ["BASIN1","BASIN2"].forEach(t => {
    if (document.querySelector(`.tank-card[data-tank="${t}"]`)?.classList.contains("expanded")) {
      renderEngTankInternals(t);
    }
  });
  // SCADA viz
  renderScada();
  ["BASIN1","BASIN2"].forEach(t => {
    const drawer = document.querySelector(`#vizDrawer${t === "BASIN1" ? 1 : 2}`);
    if (drawer && !drawer.classList.contains("hidden")) renderVizTankInternals(t);
  });
  // Counts
  const total = Object.keys(DEVICES).length;
  $("#sbrCount").textContent = `${total} equipment`;
  ["BASIN1","BASIN2"].forEach(t => {
    const list = Object.values(DEVICES).filter(d => d.loc === t);
    const active = list.filter(d => d.on).length;
    const sid = t === "BASIN1" ? "basin1Summary" : "basin2Summary";
    if ($("#"+sid)) $("#"+sid).textContent = `${list.length} pumps · ${active} active`;
  });
  // Master visuals
  document.querySelector(".group").classList.toggle("remote", remoteActive);
  document.querySelector(".view-viz").classList.toggle("remote", remoteActive);
  $("#masterMode").classList.toggle("remote", remoteActive);
  $("#masterMode").classList.toggle("local", !remoteActive);
  $("#masterMode").textContent = remoteActive ? "REMOTE" : "LOCAL (PLC)";
  $("#masterRemote").checked = remoteActive;
  applySectionSelectionVisuals();
}

function applySectionSelectionVisuals() {
  const isSel = selectedSection === "sbr";
  // Engineering group highlight
  document.querySelector(".group")?.classList.toggle("section-selected", isSel);
  // Master panel: progressive disclosure
  const masterPanel = document.getElementById("masterPanel");
  if (masterPanel) masterPanel.classList.toggle("hidden", !isSel && !remoteActive);
  // Section trigger state
  const trigger = $("#sectionBtn");
  if (trigger) {
    const sec = SECTIONS.find(s => s.id === selectedSection);
    trigger.classList.toggle("selected", !!sec);
    $("#sectionName").textContent = sec ? sec.name : "None selected";
  }
  // Mark selected option in menu
  document.querySelectorAll(".section-option").forEach(o => {
    o.classList.toggle("selected", o.dataset.section === selectedSection);
  });
  applyDimMode("scadaWrap", isSel);
  applyViewBoxForSelection(true);
  drawSectionFrame(isSel);
}

function applyDimMode(wrapId, isSel) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const svg = wrap.querySelector(".layout-svg");
  if (!svg) return;
  svg.classList.toggle("dim-mode", isSel);
  // Tag every cell as in/out of section based on bbox membership
  if (LAYOUT) {
    svg.querySelectorAll("g[data-cell-id]").forEach(node => {
      const cell = LAYOUT.idx[node.dataset.cellId];
      if (!cell) return;
      const inS = isCellInSbr(cell);
      node.classList.toggle("in-section", inS);
      node.classList.toggle("out-section", !inS);
    });
    svg.querySelectorAll(".lay-pipe").forEach(pn => {
      // pipe in-section if BOTH endpoints in section
      const ids = pn.dataset.pipeEnds?.split("|") || [];
      const a = LAYOUT.idx[ids[0]], b = LAYOUT.idx[ids[1]];
      const inS = a && b && isCellInSbr(a) && isCellInSbr(b);
      pn.classList.toggle("in-section", !!inS);
      pn.classList.toggle("out-section", !inS);
    });
  }
}

function drawSectionFrame(isSel) {
  // Dim-mode is now the primary highlight on Plant Layout; the bulky frame is removed.
  // Keep API stable for future per-section bbox rect.
  document.querySelectorAll(".section-frame").forEach(n => n.remove());
}

function selectSection(id) {
  if (remoteActive && selectedSection !== id) {
    toast("Release remote control before changing section selection.", "warn");
    return;
  }
  const sec = SECTIONS.find(s => s.id === id);
  if (sec && !sec.real) {
    toast(`${sec.name} is a demo section · no equipment wired in this prototype`, "warn");
    return; // do not select dummies
  }
  selectedSection = id;
  applySectionSelectionVisuals();
  toast(id ? `${sec.name} selected · remote control unlocked` : "Section deselected", "ok");
}

function renderSectionMenu() {
  const list = document.getElementById("sectionMenuList");
  if (!list) return;
  list.innerHTML = "";
  for (const s of SECTIONS) {
    const btn = document.createElement("button");
    btn.className = "section-option" + (s.real ? "" : " coming-soon");
    btn.dataset.section = s.id;
    btn.setAttribute("role", "option");
    btn.innerHTML = `
      <span class="opt-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6h16v12H4z"/><path d="M4 12h16"/><circle cx="9" cy="15" r="1.4"/><circle cx="13" cy="15" r="1.4"/><circle cx="17" cy="15" r="1.4"/>
        </svg>
      </span>
      <div class="opt-body">
        <div class="opt-title">${s.name}</div>
        <div class="opt-sub">${s.sub}</div>
      </div>
      ${s.real ? '<span class="opt-state"></span>' : '<span class="opt-tag">Demo</span>'}
    `;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (!s.real) { selectSection(s.id); return; } // toast only
      selectSection(selectedSection === s.id ? null : s.id);
      setMenuOpen(false);
    });
    list.appendChild(btn);
  }
}

function setMenuOpen(open) {
  const trigger = $("#sectionBtn");
  const menu = $("#sectionMenu");
  if (!trigger || !menu) return;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  menu.classList.toggle("hidden", !open);
}

// ---------- Toggle attempt ----------
function attemptToggle(id, nextOn, hostEl) {
  const d = DEVICES[id];
  if (d.mode !== "remote") return;
  const block = checkInterlock(id, nextOn);
  if (block) { showInterlock(hostEl, block); renderAll(); return; }
  d.on = nextOn;
  toast(`${d.name} → ${nextOn ? "ON" : "OFF"}`, "ok");
  renderAll();
}

function showInterlock(hostEl, msg) {
  // Engineering device: append red bar; SCADA overlay ctl: flash text
  if (hostEl.classList.contains("ctl")) {
    hostEl.classList.add("blocked");
    const orig = hostEl.innerHTML;
    hostEl.innerHTML = `<span>${msg}</span>`;
    setTimeout(() => { hostEl.classList.remove("blocked"); hostEl.innerHTML = orig; positionOverlays(); }, 3500);
    return;
  }
  hostEl.querySelectorAll(".interlock-msg").forEach(n => n.remove());
  const m = document.createElement("div");
  m.className = "interlock-msg";
  m.textContent = msg;
  hostEl.appendChild(m);
  hostEl.classList.add("blocked");
  setTimeout(() => { m.remove(); hostEl.classList.remove("blocked"); }, 3500);
  toast(msg, "bad");
}

// ---------- Tank progressive disclosure ----------
function toggleTankExpand(tankId) {
  // Engineering view
  const card = document.querySelector(`.tank-card[data-tank="${tankId}"]`);
  if (card) {
    const wasExpanded = card.classList.toggle("expanded");
    const internals = card.querySelector(".tank-internals");
    internals.classList.toggle("hidden", !wasExpanded);
    const lbl = card.querySelector(".dlabel");
    if (lbl) lbl.textContent = wasExpanded ? "Hide internal equipment" : "Show internal equipment";
    if (wasExpanded) renderEngTankInternals(tankId);
  }
  // Viz drawer (SCADA)
  const drawer = document.querySelector(`#vizDrawer${tankId === "BASIN1" ? 1 : 2}`);
  const btn = document.querySelector(`#tankExpand${tankId === "BASIN1" ? 1 : 2}`);
  if (drawer) {
    const opening = drawer.classList.contains("hidden");
    drawer.classList.toggle("hidden", !opening);
    drawer.classList.add(tankId === "BASIN1" ? "basin1" : "basin2");
    if (btn) btn.textContent = opening
      ? `▾ Hide pumps in Basin ${tankId === "BASIN1" ? 1 : 2}`
      : `▸ Pumps inside Basin ${tankId === "BASIN1" ? 1 : 2}`;
    if (opening) renderVizTankInternals(tankId);
  }
}

// ---------- Take/release flow ----------
function openTakeModal() {
  const list = $("#equipList");
  list.innerHTML = "";
  const groups = {
    "Main Section": Object.entries(DEVICES).filter(([,d]) => d.loc === "main"),
    "Inside Zone-3 · CASS Basin 1": Object.entries(DEVICES).filter(([,d]) => d.loc === "BASIN1"),
    "Inside Zone-3 · CASS Basin 2": Object.entries(DEVICES).filter(([,d]) => d.loc === "BASIN2"),
  };
  for (const [grp, items] of Object.entries(groups)) {
    const h = document.createElement("div"); h.className = "equip-group";
    h.textContent = `${grp} (${items.length})`; list.appendChild(h);
    for (const [, d] of items) {
      const r = document.createElement("div"); r.className = "equip-row";
      r.innerHTML = `<span>${d.name}</span><span class="tag">${d.type}</span>`;
      list.appendChild(r);
    }
  }
  $("#modal").classList.remove("hidden");
}
function closeTakeModal(){ $("#modal").classList.add("hidden"); $("#masterRemote").checked = remoteActive; }

function activateRemote(durationSec) {
  remoteActive = true;
  Object.values(DEVICES).forEach(d => d.mode = "remote");
  if (durationSec > 0) { remoteEndsAt = Date.now() + durationSec * 1000; startTimerTick(); }
  else { remoteEndsAt = null; $("#timerLabel").textContent = "∞ indefinite"; $("#timerChip").classList.remove("hidden"); }
  toast("Remote control ENGAGED · channel open", "warn");
  openCmdPanel();
  renderAll();
}
function releaseRemote(reason) {
  remoteActive = false;
  Object.values(DEVICES).forEach(d => d.mode = "local");
  if (remoteTimerId) { clearInterval(remoteTimerId); remoteTimerId = null; }
  remoteEndsAt = null;
  stagedCommands = {};
  $("#timerChip").classList.add("hidden");
  closeCmdPanel();
  toast(reason || "Returned to LOCAL (PLC) control", "ok");
  renderAll();
}
function startTimerTick() {
  $("#timerChip").classList.remove("hidden");
  const tick = () => {
    if (!remoteEndsAt) return;
    const ms = remoteEndsAt - Date.now();
    if (ms <= 0) { releaseRemote("Auto-return: timer expired. Equipment back on PLC."); return; }
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    $("#timerLabel").textContent = `${mm}:${ss} until auto-release`;
  };
  tick();
  remoteTimerId = setInterval(tick, 500);
}

// ---------- Technical 3-second remote loader ----------
function runRemoteLoader(onDone) {
  const overlay = document.getElementById("remoteLoader");
  const card    = overlay?.querySelector(".rl-card");
  const fill    = document.getElementById("rlBarFill");
  const log     = document.getElementById("rlLog");
  const foot    = document.getElementById("rlFootStatus");
  if (!overlay) { onDone?.(); return; }

  overlay.classList.remove("hidden");
  card.classList.remove("done");
  fill.style.transition = "none"; fill.style.right = "100%";
  log.innerHTML = "";
  foot.textContent = "handshake in progress…";
  requestAnimationFrame(() => { fill.style.transition = "right 3s linear"; fill.style.right = "0%"; });

  const startTs = Date.now();
  const ts = () => {
    const ms = Date.now() - startTs;
    const s = (ms/1000).toFixed(3).padStart(7,"0");
    return `[${s}s]`;
  };
  const append = (lvl, html) => {
    const ln = document.createElement("div");
    ln.className = `ln ${lvl}`;
    ln.innerHTML = `<span class="ts">${ts()}</span><span class="lvl">${lvl.toUpperCase()}</span><span class="msg">${html}</span>`;
    log.appendChild(ln);
    log.scrollTop = log.scrollHeight;
  };

  const lines = [
    [50,   "info", `OPEN tcp://10.42.7.18:4840 <span class="k">opcua</span>`],
    [320,  "info", `TLS handshake · cipher=<span class="k">TLS_AES_256_GCM_SHA384</span>`],
    [620,  "ok",   `PLC handshake complete · session=<span class="k">0x9F3A</span>`],
    [900,  "info", `AUTH user=<span class="k">op-mihir</span> · role=<span class="k">section_supervisor</span>`],
    [1180, "ok",   `Authentication OK · token TTL <span class="k">900s</span>`],
    [1460, "info", `Interlock matrix snapshot · <span class="k">17 nodes / 6 rules</span>`],
    [1780, "warn", `WARN BLOWER1 air-line dependency = AIR1`],
    [2050, "ok",   `Interlocks validated`],
    [2300, "info", `Control transfer · LOCAL → REMOTE`],
    [2620, "ok",   `Channel ENGAGED · heartbeat 250ms`],
    [2900, "ok",   `READY · operator now in control`],
  ];
  const timers = lines.map(([t, lvl, msg]) => setTimeout(() => append(lvl, msg), t));

  setTimeout(() => {
    overlay.classList.add("hidden");
    card.classList.add("done");
    foot.textContent = "channel ready";
    timers.forEach(clearTimeout);
    onDone?.();
  }, 3050);
}

// =====================================================================
// Zoom + Pan (viewBox manipulation)
// =====================================================================
let viewState = { x:0, y:0, w:1, h:1, defaultBox:null };

function setViewBox(box, animate=true, duration=600) {
  const svg = document.querySelector("#layoutHost .layout-svg");
  if (!svg) return;
  if (!animate) {
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
    viewState.x = box.x; viewState.y = box.y; viewState.w = box.w; viewState.h = box.h;
    updateZoomLevel();
    positionOverlays();
    return;
  }
  const start = { ...viewState };
  const t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3); // ease-out cubic
  function tick(now) {
    const t = Math.min(1, (now - t0) / duration);
    const k = ease(t);
    const cur = {
      x: start.x + (box.x - start.x) * k,
      y: start.y + (box.y - start.y) * k,
      w: start.w + (box.w - start.w) * k,
      h: start.h + (box.h - start.h) * k,
    };
    svg.setAttribute("viewBox", `${cur.x} ${cur.y} ${cur.w} ${cur.h}`);
    if (t < 1) requestAnimationFrame(tick);
    else { viewState.x = box.x; viewState.y = box.y; viewState.w = box.w; viewState.h = box.h; updateZoomLevel(); positionOverlays(); }
  }
  requestAnimationFrame(tick);
}

function updateZoomLevel() {
  const lbl = document.getElementById("zoomLevel");
  if (!lbl || !viewState.defaultBox) return;
  const pct = Math.round((viewState.defaultBox.w / viewState.w) * 100);
  lbl.textContent = `${pct}%`;
}

function applyViewBoxForSelection(animate=true) {
  if (!LAYOUT) return;
  if (!viewState.defaultBox) {
    const b = LAYOUT.bbox;
    viewState.defaultBox = { x:b.minX, y:b.minY, w:b.w, h:b.h };
    viewState.x = viewState.defaultBox.x; viewState.y = viewState.defaultBox.y;
    viewState.w = viewState.defaultBox.w; viewState.h = viewState.defaultBox.h;
  }
  if (selectedSection === "sbr") {
    // Zoom to SBR bbox with padding
    const pad = 100;
    setViewBox({
      x: SBR_BBOX.minX - pad, y: SBR_BBOX.minY - pad,
      w: (SBR_BBOX.maxX - SBR_BBOX.minX) + pad*2,
      h: (SBR_BBOX.maxY - SBR_BBOX.minY) + pad*2
    }, animate);
  } else {
    setViewBox(viewState.defaultBox, animate);
  }
}

function installZoomPan() {
  const svg = document.querySelector("#layoutHost .layout-svg");
  if (!svg) return;
  // wheel zoom (centered on cursor)
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const factor = e.deltaY > 0 ? 1.18 : 1/1.18;
    const newW = viewState.w * factor;
    const newH = viewState.h * factor;
    const newX = viewState.x + (viewState.w - newW) * fx;
    const newY = viewState.y + (viewState.h - newH) * fy;
    setViewBox({ x:newX, y:newY, w:newW, h:newH }, false);
  }, { passive: false });

  // drag to pan
  let panning = false, sx, sy, vx, vy;
  svg.addEventListener("mousedown", e => {
    if (e.target.closest("g[data-cell-id]")) return; // don't pan when clicking a device
    panning = true; svg.classList.add("panning");
    sx = e.clientX; sy = e.clientY; vx = viewState.x; vy = viewState.y;
  });
  window.addEventListener("mousemove", e => {
    if (!panning) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - sx) * (viewState.w / rect.width);
    const dy = (e.clientY - sy) * (viewState.h / rect.height);
    setViewBox({ x: vx - dx, y: vy - dy, w: viewState.w, h: viewState.h }, false);
  });
  window.addEventListener("mouseup", () => { panning = false; svg.classList.remove("panning"); });

  // Buttons
  document.getElementById("zoomIn")?.addEventListener("click", () => zoomBy(1/1.25));
  document.getElementById("zoomOut")?.addEventListener("click", () => zoomBy(1.25));
  document.getElementById("zoomFit")?.addEventListener("click", () => applyViewBoxForSelection(true));
}

function zoomBy(factor) {
  // zoom around current center
  const cx = viewState.x + viewState.w/2, cy = viewState.y + viewState.h/2;
  const w = viewState.w * factor, h = viewState.h * factor;
  setViewBox({ x: cx - w/2, y: cy - h/2, w, h }, true, 250);
}

// =====================================================================
// Command Panel (list view) + acted-on highlight in layout
// =====================================================================
let stagedCommands = {}; // { devId: nextOn }

function openCmdPanel() {
  const p = document.getElementById("cmdPanel");
  document.querySelector(".view-viz")?.classList.add("cmd-open");
  p?.classList.remove("hidden");
  renderCmdPanel();
}
function closeCmdPanel() {
  document.getElementById("cmdPanel")?.classList.add("hidden");
  document.querySelector(".view-viz")?.classList.remove("cmd-open");
  // Clear acted highlights
  document.querySelectorAll("g[data-cell-id].acted-on,g[data-cell-id].staged").forEach(n => n.classList.remove("acted-on","staged"));
}

function renderCmdPanel() {
  const body = document.getElementById("cmdBody");
  if (!body) return;
  body.innerHTML = "";
  const groups = {
    "Main Section": Object.entries(DEVICES).filter(([,d])=>d.loc==="main"),
    "CASS Basin 1 (nested)": Object.entries(DEVICES).filter(([,d])=>d.loc==="BASIN1"),
    "CASS Basin 2 (nested)": Object.entries(DEVICES).filter(([,d])=>d.loc==="BASIN2"),
  };
  for (const [grp, items] of Object.entries(groups)) {
    const head = document.createElement("div");
    head.className = "cmd-group-head";
    head.textContent = grp;
    body.appendChild(head);
    for (const [id, d] of items) {
      const isStaged = id in stagedCommands;
      const targetOn = isStaged ? stagedCommands[id] : d.on;
      const row = document.createElement("div");
      row.className = "cmd-row" + (d.on ? " on-now" : "") + (isStaged ? " staged" : "");
      row.dataset.id = id;
      row.innerHTML = `
        <div class="cmd-check ${isStaged ? "on" : ""}" title="Stage / unstage"></div>
        <div class="cmd-icon">${iconFor(d.type)}</div>
        <div class="cmd-name">${d.name}<span class="sec">${grp}</span></div>
        <span class="cmd-state ${d.on?"on":""} ${isStaged?"staged":""}">${isStaged ? (targetOn?"→ ON":"→ OFF") : (d.on?"ON":"OFF")}</span>
        <label class="switch cmd-toggle"><input type="checkbox" ${d.on?"checked":""}><span class="slider"></span></label>
      `;
      body.appendChild(row);
      // Direct toggle (instant)
      row.querySelector("input[type=checkbox]").addEventListener("change", e => {
        attemptToggleFromList(id, e.target.checked, row);
      });
      // Stage checkbox: toggle staging
      row.querySelector(".cmd-check").addEventListener("click", e => {
        e.stopPropagation();
        if (id in stagedCommands) delete stagedCommands[id];
        else stagedCommands[id] = !d.on; // stage flip
        renderCmdPanel(); refreshLayoutHighlights();
      });
      // hover row → highlight cell briefly
      row.addEventListener("mouseenter", () => highlightCellForDevice(id, "preview"));
      row.addEventListener("mouseleave", () => highlightCellForDevice(id, "off"));
    }
  }
  // Footer state
  const n = Object.keys(stagedCommands).length;
  document.getElementById("cmdStaged").textContent = `${n} staged`;
  const apply = document.getElementById("cmdApplyStaged");
  apply.textContent = `Apply ${n} command${n===1?"":"s"}`;
  apply.disabled = n === 0;
}

function attemptToggleFromList(id, nextOn, rowEl) {
  const d = DEVICES[id];
  if (d.mode !== "remote") { toast("Engage remote first", "warn"); return; }
  const block = checkInterlock(id, nextOn);
  if (block) { toast(block, "bad"); renderCmdPanel(); return; }
  d.on = nextOn;
  highlightCellForDevice(id, "acted");
  toast(`${d.name} → ${nextOn?"ON":"OFF"}`, "ok");
  renderAll();
  renderCmdPanel();
  // fade highlight after 2s
  setTimeout(() => highlightCellForDevice(id, "off"), 2200);
}

function applyStagedCommands() {
  const ids = Object.keys(stagedCommands);
  if (!ids.length) return;
  let okN = 0, blocked = [];
  for (const id of ids) {
    const next = stagedCommands[id];
    const block = checkInterlock(id, next);
    if (block) { blocked.push(`${DEVICES[id].name}: ${block}`); continue; }
    DEVICES[id].on = next; okN++;
    highlightCellForDevice(id, "acted");
  }
  stagedCommands = {};
  renderAll(); renderCmdPanel();
  setTimeout(() => document.querySelectorAll("g[data-cell-id].acted-on").forEach(n => n.classList.remove("acted-on")), 2400);
  toast(`Applied ${okN} command${okN===1?"":"s"}${blocked.length?` · ${blocked.length} blocked`:""}`, blocked.length ? "warn" : "ok");
}

function refreshLayoutHighlights() {
  // Mark staged cells in the SVG
  document.querySelectorAll("g[data-cell-id].staged").forEach(n => n.classList.remove("staged"));
  for (const id of Object.keys(stagedCommands)) {
    forEachCellNodeForDevice(id, n => n.classList.add("staged"));
  }
}

function forEachCellNodeForDevice(devId, fn) {
  if (!LAYOUT) return;
  for (const c of LAYOUT.elements) {
    if (cellDeviceId(c) === devId) {
      const node = document.querySelector(`#layoutHost g[data-cell-id="${c.id}"]`);
      if (node) fn(node);
    }
  }
}

function highlightCellForDevice(devId, mode) {
  forEachCellNodeForDevice(devId, n => {
    n.classList.toggle("acted-on", mode === "acted" || mode === "preview");
  });
}

function iconFor(type) {
  switch(type) {
    case "valve": return "⛒";
    case "blower": return "✱";
    case "pump": return "⏣";
    case "decanter": return "⇊";
    default: return "□";
  }
}



let toastT;
function toast(msg, kind="") {
  const t = $("#toast");
  t.className = "toast " + kind;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ---------- View switcher ----------
function setView(name) {
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  $("#view-engineering").classList.toggle("hidden", name !== "engineering");
  $("#view-viz").classList.toggle("hidden", name !== "viz");
  if (name === "viz") {
    requestAnimationFrame(() => { renderLayout(); positionOverlays(); });
  }
}

// ---------- Wire up ----------
document.addEventListener("DOMContentLoaded", () => {
  $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));
  // Section picker: trigger toggles menu
  $("#sectionBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const open = $("#sectionBtn").getAttribute("aria-expanded") === "true";
    setMenuOpen(!open);
  });
  renderSectionMenu();
  // Click outside closes menu
  document.addEventListener("click", e => {
    if (!e.target.closest(".section-picker")) setMenuOpen(false);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenuOpen(false); });

  // Engineering tank disclosure
  $$(".disclosure-btn").forEach(b => b.addEventListener("click", () => toggleTankExpand(b.dataset.tank)));
  // SCADA tank-expand buttons
  $$(".tank-expand-btn").forEach(b => b.addEventListener("click", () => toggleTankExpand(b.dataset.tank)));

  // Command panel
  document.getElementById("cmdClose")?.addEventListener("click", closeCmdPanel);
  document.getElementById("cmdApplyStaged")?.addEventListener("click", applyStagedCommands);
  document.getElementById("cmdClearStaged")?.addEventListener("click", () => { stagedCommands = {}; renderCmdPanel(); refreshLayoutHighlights(); });

  // Reposition overlays + section visuals on resize/scroll
  const reflow = () => { positionOverlays(); applySectionSelectionVisuals(); };
  window.addEventListener("resize", reflow);
  window.addEventListener("scroll", reflow, true);

  $("#masterRemote").addEventListener("change", e => {
    if (!selectedSection && !remoteActive) {
      e.target.checked = false;
      toast("Select a section first to take remote control.", "warn");
      return;
    }
    if (e.target.checked && !remoteActive) openTakeModal();
    else if (!e.target.checked && remoteActive) {
      $("#releaseModal").classList.remove("hidden");
      e.target.checked = true;
    }
  });
  $("#cancelModal").addEventListener("click", closeTakeModal);
  $("#confirmRemote").addEventListener("click", () => {
    const dur = parseInt($("#duration").value, 10);
    $("#modal").classList.add("hidden");
    runRemoteLoader(() => activateRemote(dur));
  });
  $("#cancelRelease").addEventListener("click", () => $("#releaseModal").classList.add("hidden"));
  $("#confirmRelease").addEventListener("click", () => { $("#releaseModal").classList.add("hidden"); releaseRemote(); });
  $("#cancelRemote").addEventListener("click", () => $("#releaseModal").classList.remove("hidden"));

  renderAll();
});
