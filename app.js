// =====================================================================
// Digital Paani · Remote Control — application logic
// =====================================================================

// ---------------- Equipment model ----------------
const DEVICES = {
  SBR1_INLET: { name: "SBR 1 Inlet Valve", type: "valve", loc: "main" },
  SBR2_INLET: { name: "SBR 2 Inlet Valve", type: "valve", loc: "main" },
  BLOWER1:    { name: "SBR Blower 1", type: "blower", loc: "main" },
  BLOWER2:    { name: "SBR Blower 2", type: "blower", loc: "main" },
  BLOWER3:    { name: "SBR Blower 3", type: "blower", loc: "main" },
  BLOWER4:    { name: "SBR Blower 4", type: "blower", loc: "main" },
  AIR1:       { name: "SBR 1 Air Inlet Line", type: "valve", loc: "main" },
  AIR2:       { name: "SBR 2 Air Inlet Line", type: "valve", loc: "main" },
  DECANTER:   { name: "SBR Decanter", type: "decanter", loc: "main" },
  RECIRC_A1:  { name: "Re-Circulation Pump A1", type: "pump", loc: "BASIN1" },
  RECIRC_A2:  { name: "Re-Circulation Pump A2", type: "pump", loc: "BASIN1" },
  SLUDGE_A1:  { name: "Sludge Sump Pump A1", type: "pump", loc: "BASIN1" },
  SLUDGE_A2:  { name: "Sludge Sump Pump A2", type: "pump", loc: "BASIN1" },
  RECIRC_B1:  { name: "Re-Circulation Pump B1", type: "pump", loc: "BASIN2" },
  RECIRC_B2:  { name: "Re-Circulation Pump B2", type: "pump", loc: "BASIN2" },
  SLUDGE_B1:  { name: "Sludge Sump Pump B1", type: "pump", loc: "BASIN2" },
  SLUDGE_B2:  { name: "Sludge Sump Pump B2", type: "pump", loc: "BASIN2" },
};
Object.values(DEVICES).forEach(d => { d.on = false; d.mode = "local"; });
DEVICES.AIR1.on = true; DEVICES.RECIRC_A1.on = true; DEVICES.BLOWER1.on = true; DEVICES.BLOWER2.on = true;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs={}) { const el = document.createElementNS(SVG_NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }

// ---------------- Interlocks ----------------
function checkInterlock(id, nextOn) {
  if (!nextOn) return null;
  if (id.startsWith("BLOWER")) {
    if (!DEVICES.AIR1.on && !DEVICES.AIR2.on) return "Blocked: at least one Air Inlet Line valve (AIR-1 or AIR-2) must be open.";
    if (DEVICES.DECANTER.on) return "Blocked: Decanter is ON. Blowers cannot run while decanter is active.";
  }
  if (id === "SBR1_INLET" && DEVICES.DECANTER.on) return "Blocked: Decanter is ON. Inlet valve cannot open during decant.";
  return null;
}

// =====================================================================
// JSON-driven Plant Layout renderer
// =====================================================================
const LABEL_TO_DEVICE = {
  "SBR 1 Inlet Valve": "SBR1_INLET", "SBR 2 Inlet Valve": "SBR2_INLET",
  "SBR 1 Air Inlet Line": "AIR1", "SBR 2 Air Inlet Line": "AIR2",
  "Re-Circulation Pump - A1": "RECIRC_A1", "Re-Circulation Pump - A2": "RECIRC_A2",
  "Sludge Sump Pump - A1": "SLUDGE_A1", "Sludge Sump Pump - A2": "SLUDGE_A2",
  "Re-Circulation Pump - B1": "RECIRC_B1", "Re-Circulation Pump - B2": "RECIRC_B2",
  "Sludge Sump Pump - B1": "SLUDGE_B1", "Sludge Sump Pump - B2": "SLUDGE_B2",
};
const SBR_BBOX = window.SBR_BBOX || { minX: 1500, minY: -1100, maxX: 3700, maxY: 1200 };
function isCellInSbr(c) {
  if (!c.position) return false;
  const x = c.position.x, y = c.position.y, w = c.size?.width||0, h = c.size?.height||0;
  return (x + w >= SBR_BBOX.minX) && (x <= SBR_BBOX.maxX) && (y + h >= SBR_BBOX.minY) && (y <= SBR_BBOX.maxY);
}

let LAYOUT = null;
let CELL_BY_ID = {};
let LAYOUT_RENDERED = false;

function loadLayout() {
  const cells = (window.SBR_CELLS || []).slice();
  const elements = cells.filter(c => c.type !== "Pipe" && c.type !== "standard.Link" && c.position);
  const links = cells.filter(c => c.type === "Pipe" || c.type === "standard.Link");
  const idx = {};
  for (const c of cells) if (c.id) idx[c.id] = c;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const c of elements) {
    const x=c.position.x,y=c.position.y,w=c.size?.width||0,h=c.size?.height||0;
    if (x<minX) minX=x; if (y<minY) minY=y; if (x+w>maxX) maxX=x+w; if (y+h>maxY) maxY=y+h;
  }
  const pad=80; minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
  const blowers = elements.filter(c => c.type === "BLW").sort((a,b)=>a.position.y-b.position.y);
  LAYOUT = { cells, elements, links, idx, bbox:{minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY}, blowerOrderIds: blowers.map(b => b.id) };
  CELL_BY_ID = idx;
}

function cellDeviceId(cell) {
  const lbl = cell.attrs?.label?.text?.trim();
  if (lbl && LABEL_TO_DEVICE[lbl]) return LABEL_TO_DEVICE[lbl];
  if (cell.type === "BLW") {
    const i = LAYOUT.blowerOrderIds.indexOf(cell.id);
    if (i >= 0) return `BLOWER${i+1}`;
  }
  if (cell.type === "SBR_TANK") {
    const tanks = LAYOUT.elements.filter(c => c.type==="SBR_TANK").sort((a,b)=>a.position.y-b.position.y);
    return tanks[0]?.id === cell.id ? "BASIN1" : "BASIN2";
  }
  return null;
}

function elGroup(c, klass) {
  const g = svgEl("g", { class: klass, "data-cell-id": c.id });
  if (c.angle) g.setAttribute("transform", `translate(${c.position.x},${c.position.y}) rotate(${c.angle} ${(c.size?.width||0)/2} ${(c.size?.height||0)/2})`);
  else g.setAttribute("transform", `translate(${c.position.x},${c.position.y})`);
  return g;
}

function drawSbrTank(c) {
  const g = elGroup(c, "lay-sbr-tank clickable-tank");
  const w = c.size.width, h = c.size.height;
  g.appendChild(svgEl("rect", { x:0, y:0, width:w, height:h, fill:"#cde0f5", stroke:"#23344e", "stroke-width":3, class:"tank-wall" }));
  const lvl = (c.level ?? 60) / 100, wh = h * lvl;
  g.appendChild(svgEl("rect", { x:2, y:h-wh, width:w-4, height:wh, fill:"#80b3e8", opacity:.85 }));
  g.appendChild(svgEl("rect", { x:2, y:h-wh, width:w-4, height:6, fill:"#cfe6ff", opacity:.6 }));
  g.appendChild(svgEl("rect", { x:20, y:h-22, width:w-40, height:6, fill:"#5a3aae" }));
  for (let i=0;i<14;i++) g.appendChild(svgEl("circle", { cx:30+i*((w-60)/13), cy:h-30-((i%3)*8), r:3, fill:"#7c5cff", opacity:.7 }));

  // stacked card edges hint
  const stackG = svgEl("g", { class:"stacked-edge" });
  stackG.appendChild(svgEl("rect", { x:12, y:-12, width:w-24, height:8, rx:3, fill:"#bcd0ee", stroke:"#3a4a7a", "stroke-width":1 }));
  stackG.appendChild(svgEl("rect", { x:6,  y:-6,  width:w-12, height:8, rx:3, fill:"#dfe8f6", stroke:"#3a4a7a", "stroke-width":1 }));
  g.insertBefore(stackG, g.firstChild);

  // peek layer
  const peek = svgEl("g", { class:"peek-layer" });
  const px0=w*0.50, py0=h*0.42, pw=w*0.45, ph=h*0.48;
  peek.appendChild(svgEl("rect", { x:px0, y:py0, width:pw, height:ph, rx:10, fill:"rgba(255,255,255,.45)", stroke:"#2a6cf0", "stroke-dasharray":"7 5", "stroke-width":2.5 }));
  for (let i=0;i<4;i++){
    const cx=px0+pw*(0.18+i*0.22), cy=py0+ph*0.55;
    peek.appendChild(svgEl("circle", { cx, cy, r:18, fill:"rgba(255,255,255,.7)", stroke:"#2a6cf0", "stroke-width":1.5 }));
    peek.appendChild(svgEl("circle", { cx, cy, r:9, fill:"#2a6cf0", opacity:.55 }));
  }
  const cornerLen=14;
  [[px0,py0,1,1],[px0+pw,py0,-1,1],[px0,py0+ph,1,-1],[px0+pw,py0+ph,-1,-1]].forEach(([x,y,sx,sy])=>{
    peek.appendChild(svgEl("path",{d:`M ${x} ${y+sy*cornerLen} L ${x} ${y} L ${x+sx*cornerLen} ${y}`, stroke:"#2a6cf0","stroke-width":3, fill:"none","stroke-linecap":"round"}));
  });
  g.appendChild(peek);

  // dbl-click badge
  const dbl = svgEl("g",{class:"dbl-badge"});
  dbl.appendChild(svgEl("rect",{x:w-180,y:8,width:172,height:26,rx:13,fill:"#0d2240",stroke:"#2a6cf0","stroke-width":1.5}));
  dbl.appendChild(svgEl("circle",{cx:w-165,cy:21,r:4,fill:"none",stroke:"#7cc4ff","stroke-width":1.5}));
  dbl.appendChild(svgEl("circle",{cx:w-156,cy:21,r:4,fill:"none",stroke:"#7cc4ff","stroke-width":1.5}));
  const dt = svgEl("text",{x:w-138,y:25,"font-size":11,fill:"#cfe3ff","font-weight":"700","letter-spacing":".8"}); dt.textContent="DBL-CLICK TO ENTER";
  dbl.appendChild(dt);
  g.appendChild(dbl);

  // info chip bottom
  const info = svgEl("g",{class:"inspect-badge"});
  const iy = h-30;
  info.appendChild(svgEl("rect",{x:14,y:iy,width:200,height:22,rx:11,fill:"rgba(13,34,64,.85)",stroke:"#3a4a7a","stroke-width":1}));
  const il = svgEl("text",{x:24,y:iy+15,"font-size":11,fill:"#9fc8ff","font-weight":"600"}); il.textContent="⊞ Contains 4 nested pumps";
  info.appendChild(il);
  g.appendChild(info);

  const t = svgEl("text",{x:w/2,y:24,"text-anchor":"middle","font-size":18,fill:"#0d2240","font-weight":"700"}); t.textContent=c.attrs?.label?.text||"";
  g.appendChild(t);

  const tanks = LAYOUT.elements.filter(x=>x.type==="SBR_TANK").sort((a,b)=>a.position.y-b.position.y);
  const basinId = tanks[0]?.id === c.id ? "BASIN1" : "BASIN2";
  let clickT;
  g.addEventListener("click",e=>{ e.stopPropagation(); clearTimeout(clickT); clickT=setTimeout(()=>toast(`Double-click ${basinId==="BASIN1"?"Basin 1":"Basin 2"} to view its 4 pumps`,"warn"),220); });
  g.addEventListener("dblclick",e=>{ e.stopPropagation(); clearTimeout(clickT); toggleTankExpand(basinId); });
  return g;
}

function drawOsTank(c, isDf) {
  const g = elGroup(c, "lay-os-tank");
  const w=c.size.width, h=c.size.height;
  g.appendChild(svgEl("rect",{x:0,y:0,width:w,height:h,fill:isDf?"#cde0f5":"#e8e6d8",stroke:"#23344e","stroke-width":3}));
  const lvl=0.6;
  g.appendChild(svgEl("rect",{x:2,y:h*(1-lvl),width:w-4,height:h*lvl-2,fill:"#80b3e8",opacity:.85}));
  if (isDf) for (let i=0;i<10;i++) g.appendChild(svgEl("circle",{cx:20+i*((w-40)/9),cy:h-20,r:2.5,fill:"#7c5cff"}));
  const t = svgEl("text",{x:w/2,y:24,"text-anchor":"middle","font-size":16,fill:"#0d2240","font-weight":"700"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}

function drawValve(c) {
  const g = elGroup(c,"lay-valve");
  const w=c.size.width, h=c.size.height, dev=cellDeviceId(c), on=dev && DEVICES[dev]?.on;
  g.appendChild(svgEl("rect",{x:-12,y:h*.35,width:w+24,height:h*.30,fill:"#9aa6c0",stroke:"#3a3a3a","stroke-width":1.2}));
  g.appendChild(svgEl("rect",{x:w*.12,y:h*.12,width:w*.76,height:h*.76,fill:on?"#1aa44a":"#d33636",stroke:"#101010","stroke-width":1.5,class:"valve-body"}));
  g.appendChild(svgEl("rect",{x:w/2-2,y:-h*.28,width:4,height:h*.4,fill:"#3a3a3a"}));
  g.appendChild(svgEl("circle",{cx:w/2,cy:-h*.28,r:5,fill:"#3a3a3a"}));
  const t = svgEl("text",{x:w/2,y:h+18,"text-anchor":"middle","font-size":12,fill:"#0d2240"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}

function drawBlower(c) {
  const dev=cellDeviceId(c), on=dev && DEVICES[dev]?.on;
  const g = elGroup(c, "lay-blower"+(on?" on":""));
  const w=c.size.width, h=c.size.height;
  g.appendChild(svgEl("rect",{x:0,y:0,width:w,height:h,rx:6,fill:"#e8eef6",stroke:"#23344e","stroke-width":2,class:"blower-body"}));
  g.appendChild(svgEl("rect",{x:6,y:6,width:w-12,height:h-12,rx:4,fill:"none",stroke:"#7892ad","stroke-width":1,"stroke-dasharray":"3 3"}));
  for (let i=0;i<5;i++){ const fy=14+i*(h-28)/5; g.appendChild(svgEl("line",{x1:14,y1:fy,x2:w-14,y2:fy,stroke:"#9aa6c0","stroke-width":1,opacity:.55})); }
  g.appendChild(svgEl("rect",{x:10,y:10,width:14,height:14,rx:2,fill:"#1a1a1a",stroke:"#3a3a3a"}));
  g.appendChild(svgEl("circle",{cx:17,cy:17,r:5,class:"blower-led",fill:"#d33636"}));
  g.appendChild(svgEl("path",{d:`M ${w-18} ${h*.4} L ${w} ${h*.5} L ${w-18} ${h*.6} Z`,fill:"#7892ad",stroke:"#23344e","stroke-width":1.2}));
  const flow = svgEl("g",{class:"airflow"});
  for (let i=0;i<3;i++) flow.appendChild(svgEl("path",{d:`M ${w+2} ${h*.5 - 14 + i*14} q 16 -6 32 0 t 32 0`,fill:"none",stroke:"#1aa44a","stroke-width":2,"stroke-linecap":"round"}));
  g.appendChild(flow);
  g.appendChild(svgEl("rect",{x:w/2-18,y:h/2-7,width:36,height:14,rx:2,fill:"#1c2742",stroke:"#3e4b73"}));
  const tag = svgEl("text",{x:w/2,y:h/2+4,"text-anchor":"middle","font-size":10,fill:"#9fc8ff","font-weight":"700","font-family":"monospace"}); tag.textContent="BLW"; g.appendChild(tag);
  return g;
}

function drawSubPmp(c) {
  const g = elGroup(c,"lay-sub-pmp");
  const w=c.size.width, h=c.size.height, dev=cellDeviceId(c), on=dev && DEVICES[dev]?.on;
  const cx=w/2;
  g.appendChild(svgEl("rect",{x:cx-8,y:0,width:16,height:h*0.45,fill:"#9aa6c0",stroke:"#3a3a3a"}));
  g.appendChild(svgEl("rect",{x:cx-30,y:h*0.45,width:60,height:h*0.30,rx:8,fill:"#1a1a1a",stroke:"#000"}));
  g.appendChild(svgEl("circle",{cx,cy:h*0.85,r:Math.min(w,h)*0.18,fill:on?"#1aa44a":"#d33636",stroke:"#101010","stroke-width":2}));
  const t = svgEl("text",{x:w/2,y:h+18,"text-anchor":"middle","font-size":13,fill:"#0d2240"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}
function drawLevelSensor(c){
  const g=elGroup(c,"lay-level"); const w=c.size.width,h=c.size.height,lvl=(c.level??50)/100;
  g.appendChild(svgEl("rect",{x:w*.15,y:8,width:w*.45,height:h-16,fill:"#0f1626",stroke:"#3b4d70"}));
  const fh=(h-16)*lvl;
  g.appendChild(svgEl("rect",{x:w*.17,y:h-8-fh,width:w*.41,height:fh,fill:c.liquidColor||"#1aa44a"}));
  for (let i=0;i<=10;i++){ const ty=8+(h-16)*(i/10); g.appendChild(svgEl("line",{x1:w*.62,y1:ty,x2:w*.70,y2:ty,stroke:"#0d2240","stroke-width":1}));
    const t=svgEl("text",{x:w*.74,y:ty+4,"font-size":9,fill:"#0d2240"}); t.textContent=String(100-i*10); g.appendChild(t); }
  const t=svgEl("text",{x:w/2,y:h+16,"text-anchor":"middle","font-size":12,fill:"#0d2240","font-weight":"700"}); t.textContent=c.attrs?.label?.text||"Level"; g.appendChild(t);
  return g;
}
function drawNumberSensor(c){
  const g=elGroup(c,"lay-num"); const w=c.size.width,h=c.size.height;
  const lbl=svgEl("text",{x:w/2,y:14,"text-anchor":"middle","font-size":11,fill:"#0d2240"}); lbl.textContent=c.attrs?.label?.text||""; g.appendChild(lbl);
  g.appendChild(svgEl("rect",{x:6,y:22,width:w-12,height:h-30,fill:"#0f1626",stroke:"#3a4a7a"}));
  const v=svgEl("text",{x:w/2,y:h-12,"text-anchor":"middle","font-size":18,fill:"#fff","font-weight":"700"}); v.textContent=(c.value??0).toString(); g.appendChild(v);
  return g;
}
function drawSwitchSensor(c){
  const g=elGroup(c,"lay-switch"); const w=c.size.width,h=c.size.height;
  g.appendChild(svgEl("rect",{x:w*.15,y:6,width:w*.7,height:w*.7,fill:"#d33636",stroke:"#7a0e0e","stroke-width":1.5}));
  g.appendChild(svgEl("circle",{cx:w/2,cy:6+w*.35,r:5,fill:"#fff"}));
  const t=svgEl("text",{x:w/2,y:h-4,"text-anchor":"middle","font-size":10,fill:"#0d2240","font-weight":"700"}); t.textContent=c.attrs?.label?.text||"ON/OFF"; g.appendChild(t);
  return g;
}
function drawZone(c){
  const g=elGroup(c,"lay-zone"); const w=c.size.width,h=c.size.height;
  g.appendChild(svgEl("path",{d:`M0,${h/2} L${w*.8},${h/2} L${w*.8},2 L${w},${h/2} L${w*.8},${h-2} L${w*.8},${h/2}`,fill:"#cfe3ff",stroke:"#3a4a7a"}));
  const t=svgEl("text",{x:w/2-4,y:h/2+4,"text-anchor":"middle","font-size":10,fill:"#0d2240"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}
function drawJoins(c){
  const g=elGroup(c,"lay-join"); const w=c.size.width,h=c.size.height;
  g.appendChild(svgEl("circle",{cx:w/2,cy:h/2,r:Math.min(w,h)/2-2,fill:"#fff",stroke:"#3a4a7a","stroke-width":1.5}));
  const t=svgEl("text",{x:w/2,y:h/2+3,"text-anchor":"middle","font-size":9,fill:"#0d2240"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}
function drawLabelWidget(c){
  const g=elGroup(c,"lay-label"); const w=c.size.width,h=c.size.height;
  const t=svgEl("text",{x:w/2,y:h/2+5,"text-anchor":"middle","font-size":14,fill:"#0d2240","font-weight":"700"}); t.textContent=c.attrs?.label?.text||""; g.appendChild(t);
  return g;
}

const TYPE_DRAWERS = {
  SBR_TANK: drawSbrTank, OS_TANK: c=>drawOsTank(c,false), OS_TANK_DF: c=>drawOsTank(c,true),
  VALVE_2: drawValve, BLW: drawBlower, SUB_PMP: drawSubPmp, PMP: drawSubPmp,
  LEVEL_SENSOR: drawLevelSensor, NUMBER_SENSOR: drawNumberSensor, SWITCH_SENSOR: drawSwitchSensor,
  ZONE: drawZone, JOINS: drawJoins, LABEL_WIDGET: drawLabelWidget,
};

function cellCenter(c){ if (!c||!c.position) return null; return { x:c.position.x+(c.size?.width||0)/2, y:c.position.y+(c.size?.height||0)/2 }; }
function drawPipe(p) {
  const src=CELL_BY_ID[p.source?.id], tgt=CELL_BY_ID[p.target?.id];
  if (!src||!tgt) return null;
  const a=cellCenter(src), b=cellCenter(tgt);
  if (!a||!b) return null;
  const verts=(p.vertices||[]).map(v=>`${v.x},${v.y}`);
  const pts=[`${a.x},${a.y}`,...verts,`${b.x},${b.y}`];
  const g = svgEl("g",{class:"lay-pipe","data-pipe-ends":`${p.source.id}|${p.target.id}`});
  g.appendChild(svgEl("polyline",{points:pts.join(" "),fill:"none",stroke:"#7e96b3","stroke-width":8,"stroke-linejoin":"miter","stroke-linecap":"butt"}));
  g.appendChild(svgEl("polyline",{points:pts.join(" "),fill:"none",stroke:p.liquidColor||"#cfd8ee","stroke-width":4,"stroke-linejoin":"miter","stroke-linecap":"butt",opacity:.9}));
  return g;
}

function renderLayout() {
  if (!LAYOUT) loadLayout();
  const host = document.getElementById("layoutHost");
  if (!host || !LAYOUT) return;
  host.innerHTML = "";
  const { bbox, elements, links } = LAYOUT;
  const svg = svgEl("svg",{class:"layout-svg",viewBox:`${bbox.minX} ${bbox.minY} ${bbox.w} ${bbox.h}`,preserveAspectRatio:"xMidYMid meet"});
  host.appendChild(svg);
  const layerPipes=svgEl("g",{class:"layer-pipes"}), layerBack=svgEl("g",{class:"layer-back"}), layerEquip=svgEl("g",{class:"layer-equip"}), layerText=svgEl("g",{class:"layer-text"});
  svg.append(layerPipes,layerBack,layerEquip,layerText);
  for (const p of links){ const el=drawPipe(p); if (el) layerPipes.appendChild(el); }
  for (const c of elements){
    const drawer=TYPE_DRAWERS[c.type]; if (!drawer) continue;
    const node = drawer(c); if (!node) continue;
    if (c.type==="SBR_TANK"||c.type==="OS_TANK"||c.type==="OS_TANK_DF") layerBack.appendChild(node);
    else if (c.type==="LABEL_WIDGET"||c.type==="NUMBER_SENSOR") layerText.appendChild(node);
    else layerEquip.appendChild(node);
  }
  installZoomPan();
}

function renderScada() {
  if (LAYOUT_RENDERED) return;
  renderLayout();
  LAYOUT_RENDERED = true;
}

function updateDeviceCells(devId){
  if (!LAYOUT) return;
  for (const c of LAYOUT.elements){
    if (cellDeviceId(c) !== devId) continue;
    const oldNode = document.querySelector(`#layoutHost g[data-cell-id="${c.id}"]`);
    if (!oldNode) continue;
    const drawer = TYPE_DRAWERS[c.type]; if (!drawer) continue;
    const newNode = drawer(c);
    ["in-section","out-section","acted-on","staged","preview-hover"].forEach(k => { if (oldNode.classList.contains(k)) newNode.classList.add(k); });
    oldNode.replaceWith(newNode);
  }
}

// =====================================================================
// Zoom + Pan
// =====================================================================
let viewState = { x:0, y:0, w:1, h:1, defaultBox:null };
function setViewBox(box, animate=true, duration=400){
  const svg = document.querySelector("#layoutHost .layout-svg"); if (!svg) return;
  if (!animate) { svg.setAttribute("viewBox",`${box.x} ${box.y} ${box.w} ${box.h}`); Object.assign(viewState,box); updateZoomLevel(); return; }
  const start = { ...viewState }, t0 = performance.now(), ease = t => 1 - Math.pow(1-t,3);
  function tick(now){
    const t = Math.min(1, (now - t0)/duration), k = ease(t);
    const cur = { x:start.x+(box.x-start.x)*k, y:start.y+(box.y-start.y)*k, w:start.w+(box.w-start.w)*k, h:start.h+(box.h-start.h)*k };
    svg.setAttribute("viewBox",`${cur.x} ${cur.y} ${cur.w} ${cur.h}`);
    if (t<1) requestAnimationFrame(tick); else { Object.assign(viewState,box); updateZoomLevel(); }
  }
  requestAnimationFrame(tick);
}
function updateZoomLevel(){
  const lbl = document.getElementById("zoomLevel");
  if (!lbl || !viewState.defaultBox) return;
  lbl.textContent = `${Math.round((viewState.defaultBox.w/viewState.w)*100)}%`;
}
function fitDefault(){
  if (!LAYOUT) return;
  const b=LAYOUT.bbox; viewState.defaultBox = { x:b.minX, y:b.minY, w:b.w, h:b.h };
  setViewBox(viewState.defaultBox, false);
}
function installZoomPan(){
  const svg = document.querySelector("#layoutHost .layout-svg"); if (!svg) return;
  fitDefault();
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const rect=svg.getBoundingClientRect();
    const fx=(e.clientX-rect.left)/rect.width, fy=(e.clientY-rect.top)/rect.height;
    const factor = e.deltaY>0 ? 1.18 : 1/1.18;
    const newW = viewState.w*factor, newH=viewState.h*factor;
    const newX = viewState.x+(viewState.w-newW)*fx, newY=viewState.y+(viewState.h-newH)*fy;
    setViewBox({x:newX,y:newY,w:newW,h:newH}, false);
  }, { passive:false });
  let panning=false, sx, sy, vx, vy;
  svg.addEventListener("mousedown", e => {
    if (e.target.closest("g[data-cell-id]")) return;
    panning=true; svg.classList.add("panning");
    sx=e.clientX; sy=e.clientY; vx=viewState.x; vy=viewState.y;
  });
  window.addEventListener("mousemove", e => {
    if (!panning) return;
    const rect=svg.getBoundingClientRect();
    const dx=(e.clientX-sx)*(viewState.w/rect.width), dy=(e.clientY-sy)*(viewState.h/rect.height);
    setViewBox({x:vx-dx,y:vy-dy,w:viewState.w,h:viewState.h}, false);
  });
  window.addEventListener("mouseup", () => { panning=false; svg.classList.remove("panning"); });
}
function zoomBy(factor){
  const cx=viewState.x+viewState.w/2, cy=viewState.y+viewState.h/2;
  const w=viewState.w*factor, h=viewState.h*factor;
  setViewBox({x:cx-w/2, y:cy-h/2, w, h}, true, 250);
}

// =====================================================================
// Tank drawer
// =====================================================================
function toggleTankExpand(tankId){
  const drawer = document.getElementById(tankId==="BASIN1"?"vizDrawer1":"vizDrawer2");
  if (!drawer) return;
  const opening = drawer.classList.contains("hidden");
  // close both first
  document.getElementById("vizDrawer1").classList.add("hidden");
  document.getElementById("vizDrawer2").classList.add("hidden");
  if (opening) { drawer.classList.remove("hidden"); renderTankInternals(tankId); }
}
function renderTankInternals(tankId){
  const host = document.querySelector(`[data-viz-internals="${tankId}"]`);
  if (!host) return;
  host.innerHTML = `<div class="tank-drawer-head"><div class="ttl">Inside ${tankId==="BASIN1"?"CASS Basin 1":"CASS Basin 2"}</div><button class="dp-side-close" data-collapse>${"✕ Close"}</button></div>`;
  Object.entries(DEVICES).filter(([,d])=>d.loc===tankId).forEach(([id,d])=>{
    const el = document.createElement("div");
    el.className = "mini-device" + (d.on?" on":"");
    el.dataset.id = id;
    el.innerHTML = `<div class="mini-icon">⏣</div><div class="mini-name">${d.name}</div><div class="mini-controls"></div>`;
    host.appendChild(el);
    const c = el.querySelector(".mini-controls");
    const pill = document.createElement("span"); pill.className="mode-pill sm " + (d.mode==="remote"?"remote":"local"); pill.textContent = d.mode==="remote"?"REMOTE":"LOCAL";
    c.appendChild(pill);
    const lab = document.createElement("label"); lab.className="switch";
    const inp = document.createElement("input"); inp.type="checkbox"; inp.checked = d.on; inp.disabled = d.mode!=="remote";
    inp.addEventListener("change", e => attemptToggle(id, e.target.checked));
    const sl = document.createElement("span"); sl.className="slider";
    lab.append(inp, sl); c.appendChild(lab);
  });
  host.querySelector("[data-collapse]")?.addEventListener("click", () => host.classList.add("hidden"));
}

// =====================================================================
// Toggle action (partial update — no SVG rebuild)
// =====================================================================
function attemptToggle(id, nextOn) {
  const d = DEVICES[id];
  const block = checkInterlock(id, nextOn);
  if (block) { toast(block, "bad"); return; }
  d.on = nextOn;
  toast(`${d.name} → ${nextOn?"ON":"OFF"}`, "ok");
  updateDeviceCells(id);
  // Pulse the layout cell
  document.querySelectorAll(`#layoutHost g[data-cell-id]`).forEach(n => {
    const cell = LAYOUT?.idx[n.dataset.cellId];
    if (cell && cellDeviceId(cell) === id) n.classList.add("acted-on");
  });
  setTimeout(() => document.querySelectorAll(`#layoutHost g.acted-on`).forEach(n => n.classList.remove("acted-on")), 1800);
}

// =====================================================================
// Group Control side panel
// =====================================================================
function openGroupPanel() {
  document.getElementById("groupPanel").classList.remove("hidden");
  document.getElementById("dpMain").classList.add("side-open");
  document.body.classList.add("side-drawer-open");
  renderEquipmentList();
  toast("Group Control opened · select equipment to control", "ok");
}
function closeGroupPanel() {
  document.getElementById("groupPanel").classList.add("hidden");
  if (document.getElementById("setPointsPanel").classList.contains("hidden")) {
    document.getElementById("dpMain").classList.remove("side-open");
    document.body.classList.remove("side-drawer-open");
  }
}
function renderEquipmentList() {
  const list = document.getElementById("equipList");
  if (!list) return;
  list.innerHTML = "";
  const ids = Object.keys(DEVICES);
  document.getElementById("equipCountPill").textContent = `${ids.length} equipments`;
  document.getElementById("groupCount").textContent = ids.length;
  for (const id of ids) renderEquipmentRow(list, id);
}

function renderEquipmentRow(list, id) {
  const d = DEVICES[id];
  const wrap = document.createElement("div");
  wrap.className = "dp-equip-wrap" + (d.on?" on-now":"");
  wrap.dataset.id = id;
  wrap.innerHTML = `
    <div class="dp-equip-row">
      <div class="eq-icon-tile">${iconFor(d.type)}</div>
      <div class="eq-meta">
        <div class="name">${d.name}</div>
        <span class="type-pill">${d.type.toUpperCase()}</span>
        <div class="status-line">STATUS: <b class="${d.on?'on':'off'}">${d.on?'On':'Off'}</b></div>
      </div>
      <span class="eq-chev" aria-hidden="true">▾</span>
    </div>
    <div class="dp-equip-expand"></div>
  `;
  wrap.querySelector(".dp-equip-row").addEventListener("click", () => toggleEquipmentRow(wrap, id));
  wrap.addEventListener("mouseenter", () => highlightDevice(id, true));
  wrap.addEventListener("mouseleave", () => highlightDevice(id, false));
  list.appendChild(wrap);
}

// Only one row expanded at a time
function toggleEquipmentRow(wrap, id) {
  const isOpen = wrap.classList.contains("expanded");
  document.querySelectorAll(".dp-equip-wrap.expanded").forEach(w => { w.classList.remove("expanded"); w.querySelector(".dp-equip-expand").innerHTML = ""; });
  if (isOpen) return;
  wrap.classList.add("expanded");
  renderEquipmentExpansion(wrap, id);
}

function renderEquipmentExpansion(wrap, id) {
  const host = wrap.querySelector(".dp-equip-expand");
  host.innerHTML = "";

  const linked = (window.SETPOINTS||[]).filter(sp => sp.targets?.includes(id));
  const h = document.createElement("div");
  h.className = "exp-sp-head";
  h.textContent = linked.length ? `LINKED SET POINTS · ${linked.length}` : "LINKED SET POINTS";
  host.appendChild(h);

  if (!linked.length) {
    const empty = document.createElement("div");
    empty.className = "exp-empty";
    empty.textContent = "No set points linked to this equipment.";
    host.appendChild(empty);
    return;
  }
  for (const sp of linked) host.appendChild(renderSetpointCard(sp));
}
function refreshEquipmentRow(id) {
  const row = document.querySelector(`.dp-equip-row[data-id="${id}"]`);
  if (!row) return;
  const d = DEVICES[id];
  row.classList.toggle("on-now", d.on);
  const status = row.querySelector(".status-line");
  if (status) status.innerHTML = `STATUS: <b class="${d.on?'on':'off'}">${d.on?'On':'Off'}</b>`;
}
function highlightDevice(id, on) {
  if (!LAYOUT) return;
  for (const c of LAYOUT.elements) {
    if (cellDeviceId(c) !== id) continue;
    const node = document.querySelector(`#layoutHost g[data-cell-id="${c.id}"]`);
    if (node) node.classList.toggle("preview-hover", on);
  }
}
function iconFor(type) {
  switch(type) {
    case "valve":   return "⛒";
    case "blower":  return "✱";
    case "pump":    return "⏣";
    case "decanter":return "⇊";
    default: return "■";
  }
}

// =====================================================================
// Set Point card renderer (used inline + on All Set Points page)
// =====================================================================
function renderSetpointCard(sp) {
  const card = document.createElement("div");
  card.className = "sp-card";
  card.dataset.spId = sp.id;
  const typeShort = sp.type.replace(/\s.+/, "").slice(0,4).toUpperCase();
  card.innerHTML = `
    <div class="sp-card-head">
      <div class="left">
        <div class="sp-icon-tile">${typeShort}</div>
        <div>
          <div class="sp-card-title">${sp.name}</div>
          <div class="sp-card-sub">${sp.type} · range ${sp.min}–${sp.max} ${sp.unit}</div>
          <code class="sp-hmi-tag">HMI tag: ${sp.hmiTag||"—"}</code>
        </div>
      </div>
    </div>
    <div class="sp-card-body">
      <div class="sp-value-row">
        <span class="sp-value-label">Set point value</span>
        <div class="sp-value-input" data-mode="view">
          <input type="number" step="${sp.unit==='pH'?'0.1':sp.unit==='bar'?'0.1':sp.unit==='ppm'?'0.1':'1'}" value="${sp.current}" data-sp-value readonly>
          <span class="unit">${sp.unit}</span>
          <button class="pencil" data-sp-edit title="Edit set point">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
        </div>
      </div>
      <div class="sp-card-actions hidden" data-sp-actions>
        <button class="dp-btn ghost sm" data-sp-cancel>Cancel</button>
        <button class="dp-btn primary sm" data-sp-save>Save change</button>
      </div>
      ${sp.active ? "" : '<div class="sp-disabled-note">⚠ This set point is disabled — value will not be applied.</div>'}
    </div>
  `;

  const wrap = card.querySelector("[data-mode]");
  const input = card.querySelector("[data-sp-value]");
  const editBtn = card.querySelector("[data-sp-edit]");
  const actions = card.querySelector("[data-sp-actions]");
  const cancelBtn = card.querySelector("[data-sp-cancel]");
  const saveBtn = card.querySelector("[data-sp-save]");

  editBtn.addEventListener("click", e => {
    e.stopPropagation();
    wrap.dataset.mode = "edit";
    wrap.classList.add("editing");
    input.removeAttribute("readonly");
    input.focus(); input.select();
    actions.classList.remove("hidden");
  });
  cancelBtn.addEventListener("click", e => {
    e.stopPropagation();
    input.value = sp.current;
    wrap.dataset.mode = "view";
    wrap.classList.remove("editing");
    input.setAttribute("readonly", "");
    actions.classList.add("hidden");
  });
  saveBtn.addEventListener("click", e => {
    e.stopPropagation();
    promptApplySetpoint(sp.id, parseFloat(input.value));
  });

  // Prevent the row-click toggle from collapsing this card
  card.addEventListener("click", e => e.stopPropagation());
  return card;
}

// =====================================================================
// Set Point edit — confirmation notice
// =====================================================================
let pendingSp = null;
function promptApplySetpoint(spId, newValue) {
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId);
  if (!sp) return;
  if (isNaN(newValue)) { toast("Enter a valid number", "warn"); return; }
  if (newValue < sp.min || newValue > sp.max) { toast(`Value out of allowed range (${sp.min}–${sp.max} ${sp.unit})`, "bad"); return; }
  if (!sp.active) { toast("This set point is disabled", "warn"); return; }
  pendingSp = { spId, newValue };
  document.getElementById("spNoticeBody").innerHTML = `
    You're about to overwrite the HMI tag
    <code style="background:#fafaf6;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:12px;color:var(--text)">${sp.hmiTag || "—"}</code>
    from <b>${sp.current} ${sp.unit}</b> to <b>${newValue} ${sp.unit}</b>.
    <br><br>
    The PLC will use the new value on its next evaluation tick. Linked equipment behaviour may change.
  `;
  const impact = document.getElementById("spImpactList");
  impact.innerHTML = `<div class="sp-impact-head">LINKED EQUIPMENT</div>` + (sp.targets||[]).map(t => {
    const dev = DEVICES[t];
    return `<div class="sp-impact-row">
      <span class="arrow">→</span>
      <span class="target">${dev?dev.name:t}</span>
    </div>`;
  }).join("");
  document.getElementById("spNotice").classList.remove("hidden");
}
function applyPendingSp() {
  if (!pendingSp) return;
  const sp = (window.SETPOINTS||[]).find(x => x.id === pendingSp.spId);
  if (!sp) return;
  const from = sp.current;
  sp.current = pendingSp.newValue;
  sp.source  = `Operator override · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
  sp.history = sp.history || [];
  sp.history.push({ ts: new Date().toISOString(), kind: "value", from, to: sp.current, who: "you" });
  toast(`Set point override applied · ${sp.name} = ${sp.current} ${sp.unit}`, "ok");
  document.getElementById("spNotice").classList.add("hidden");
  pendingSp = null;
  refreshSetpointAllViews(sp.id);
}
function refreshSetpointAllViews(spId) {
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId); if (!sp) return;
  document.querySelectorAll(`.sp-card[data-sp-id="${spId}"]`).forEach(old => old.replaceWith(renderSetpointCard(sp)));
  document.querySelectorAll(`.spd-card[data-sp-id="${spId}"]`).forEach(old => old.replaceWith(renderSpdCard(sp)));
}

// =====================================================================
// All Set Points page
// =====================================================================
function renderSetpointsPage() {
  const list = document.getElementById("spList");
  if (!list) return;
  list.innerHTML = "";
  const search = (document.getElementById("spSearch")?.value || "").toLowerCase();
  const tFilter = document.getElementById("spTypeFilter")?.value || "";
  const sps = (window.SETPOINTS||[]).filter(sp => {
    if (tFilter && sp.type !== tFilter) return false;
    if (search && !(sp.name.toLowerCase().includes(search) || sp.equipment.toLowerCase().includes(search) || sp.type.toLowerCase().includes(search))) return false;
    return true;
  });
  for (const sp of sps) list.appendChild(renderSetpointTile(sp));
}
function renderSetpointTile(sp) {
  const tile = document.createElement("div");
  tile.className = "sp-tile";
  tile.dataset.spId = sp.id;
  const cur = ((sp.current - sp.min) / (sp.max - sp.min || 1)) * 100;
  tile.innerHTML = `
    <div class="sp-tile-head">
      <div class="sp-icon-tile">${sp.type.slice(0,3).toUpperCase()}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="sp-type-tag">${sp.type}</span>
          ${sp.active ? '' : '<span class="sp-type-tag" style="background:#fdeaea;color:#aa1c1c">DISABLED</span>'}
        </div>
        <div class="sp-tile-name" style="margin-top:6px">${sp.name}</div>
        <div class="sp-tile-equip">${sp.equipment}</div>
        <code class="sp-hmi-tag">HMI tag: ${sp.hmiTag||"—"}</code>
      </div>
    </div>
    <div class="sp-tile-current">${sp.current}<span class="unit">${sp.unit}</span></div>
    <div class="sp-range-bar"><div class="marker" style="left:calc(${cur}% - 1.5px)"></div></div>
    <div class="sp-range-ticks">
      <span>min ${sp.min}${sp.unit}</span>
      <span>max ${sp.max}${sp.unit}</span>
    </div>
    <div class="sp-tile-footer">
      <div class="sp-tile-source">SOURCE: <b>${sp.source}</b></div>
      <button class="sp-edit-btn">Edit</button>
    </div>
  `;
  tile.querySelector(".sp-edit-btn").addEventListener("click", () => openInlineEdit(tile, sp));
  return tile;
}
function openInlineEdit(tile, sp) {
  const current = tile.querySelector(".sp-tile-current");
  const original = current.innerHTML;
  current.innerHTML = `
    <div class="sp-input" style="display:inline-flex">
      <input type="number" step="${sp.unit==='pH'?'0.1':'1'}" value="${sp.current}" id="inlineSpVal">
      <span class="unit">${sp.unit}</span>
      <button class="save" id="inlineSpSave">Apply</button>
    </div>
    <button class="dp-btn ghost sm" id="inlineSpCancel" style="margin-left:6px">Cancel</button>
  `;
  document.getElementById("inlineSpSave").addEventListener("click", () => promptApplySetpoint(sp.id, parseFloat(document.getElementById("inlineSpVal").value)));
  document.getElementById("inlineSpCancel").addEventListener("click", () => { current.innerHTML = original; });
}

// =====================================================================
// Page switcher
// =====================================================================
function switchPage(p) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  if (p === "dashboard") {
    $("#view-dashboard").classList.remove("hidden");
    renderDashboard();
  } else if (p === "studio") {
    $("#view-studio").classList.remove("hidden");
    renderStudio();
    installPaletteDrag();
  } else if (p === "cfg") {
    $("#view-cfg").classList.remove("hidden");
    renderCfgTable();
  } else {
    $("#view-layout").classList.remove("hidden");
    requestAnimationFrame(renderScada);
  }
}

// =====================================================================
// SIMPLE SET POINT CONFIGURATION (standalone admin page)
// =====================================================================
const CFG_TYPES = [
  { type: "Level",                 unit: "%"     },
  { type: "DO",                    unit: "mg/L"  },
  { type: "Differential Pressure", unit: "bar"   },
  { type: "pH",                    unit: "pH"    },
  { type: "FRC",                   unit: "ppm"   },
  { type: "ORP",                   unit: "mV"    },
  { type: "Flow",                  unit: "m³/hr" },
  { type: "Time",                  unit: "min"   },
  { type: "Transfer Pump",         unit: "%"     },
];

function cfgUnitFor(type) {
  return CFG_TYPES.find(t => t.type === type)?.unit || "";
}

function renderCfgTable() {
  const search = ($("#cfgSearch2")?.value || "").toLowerCase();
  const tFilter = $("#cfgFilterType")?.value || "";
  const list = window.SETPOINTS || [];

  // Populate type filter once
  const filt = $("#cfgFilterType");
  if (filt && filt.options.length <= 1) {
    for (const t of CFG_TYPES) {
      const opt = document.createElement("option");
      opt.value = t.type; opt.textContent = t.type;
      filt.appendChild(opt);
    }
  }

  // Collapse Transfer Pump sub-setpoints (with shared groupId) into one row
  const seen = new Set();
  const rows = [];
  for (const sp of list) {
    if (sp.type === "LT" && sp.groupId) {
      if (seen.has(sp.groupId)) continue;
      seen.add(sp.groupId);
      const members = list.filter(s => s.groupId === sp.groupId);
      rows.push({ kind: "tp", group: { id: sp.groupId, name: sp.groupName, members } });
    } else {
      rows.push({ kind: "single", sp });
    }
  }

  const filtered = rows.filter(r => {
    const sp = r.kind === "tp" ? r.group : r.sp;
    const type = r.kind === "tp" ? "Transfer Pump" : sp.type;
    if (tFilter && type !== tFilter) return false;
    if (search) {
      const txt = r.kind === "tp"
        ? (r.group.name + " " + r.group.members.map(m => m.hmiTag).join(" "))
        : (sp.name + " " + (sp.hmiTag||"") + " " + sp.type + " " + (sp.description||""));
      if (!txt.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  $("#cfgCount2").textContent = `${filtered.length} configured`;

  const tbl = $("#cfgTable2");
  tbl.innerHTML = `
    <div class="cfg-row2 head">
      <div>Type</div><div>Name &amp; description</div><div>HMI tag</div><div>Range</div><div>Unit</div><div></div>
    </div>
  `;
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:40px 20px;text-align:center;color:var(--muted);font-size:13px";
    empty.textContent = "No set points configured. Click + Add set point to create one.";
    tbl.appendChild(empty);
    return;
  }
  for (const r of filtered) tbl.appendChild(renderCfgRow(r));
}

function renderCfgRow(r) {
  if (r.kind === "tp") {
    const g = r.group;
    const m = g.members;
    const srcMin = m.find(x => x.subRole === "SOURCEMIN");
    const srcMax = m.find(x => x.subRole === "SOURCEMAX");
    const dstMin = m.find(x => x.subRole === "DESTMIN");
    const dstMax = m.find(x => x.subRole === "DESTMAX");
    const row = document.createElement("div");
    row.className = "cfg-row2";
    row.dataset.groupId = g.id;
    row.innerHTML = `
      <div><span class="c-type">Transfer Pump</span></div>
      <div>
        <div class="c-name">${g.name}</div>
        <div class="c-desc">${m[0]?.description || "Source + destination tank levels — 4 HMI tags"}</div>
      </div>
      <div class="c-hmi">${m.map(x => `<code>${x.hmiTag}</code>`).join(" ")}</div>
      <div class="c-range">
        Src: ${srcMin?.current ?? "—"} – ${srcMax?.current ?? "—"}<br>
        Dst: ${dstMin?.current ?? "—"} – ${dstMax?.current ?? "—"}
      </div>
      <div class="c-range">%</div>
      <div><button class="ic-btn">✎</button></div>
      <div class="cfg-tp-sublist">
        <div class="cfg-tp-cell"><div class="k">SRC MIN · safe</div><div class="v">${srcMin?.min ?? "—"} – ${srcMin?.max ?? "—"} %</div></div>
        <div class="cfg-tp-cell"><div class="k">SRC MAX · safe</div><div class="v">${srcMax?.min ?? "—"} – ${srcMax?.max ?? "—"} %</div></div>
        <div class="cfg-tp-cell"><div class="k">DST MIN · safe</div><div class="v">${dstMin?.min ?? "—"} – ${dstMin?.max ?? "—"} %</div></div>
        <div class="cfg-tp-cell"><div class="k">DST MAX · safe</div><div class="v">${dstMax?.min ?? "—"} – ${dstMax?.max ?? "—"} %</div></div>
      </div>
    `;
    row.addEventListener("click", () => openCfgModal({ kind: "tp", groupId: g.id }));
    return row;
  }
  const sp = r.sp;
  const row = document.createElement("div");
  row.className = "cfg-row2";
  row.dataset.id = sp.id;
  row.innerHTML = `
    <div><span class="c-type">${sp.type}</span></div>
    <div>
      <div class="c-name">${sp.name}</div>
      <div class="c-desc">${sp.description || "—"}</div>
    </div>
    <div class="c-hmi"><code>${sp.hmiTag||"—"}</code></div>
    <div class="c-range">${sp.min ?? "—"} – ${sp.max ?? "—"}</div>
    <div class="c-range">${sp.unit||"—"}</div>
    <div><button class="ic-btn">✎</button></div>
  `;
  row.addEventListener("click", () => openCfgModal({ kind: "single", spId: sp.id }));
  return row;
}

let cfgEditing = null; // { kind:'single', spId } | { kind:'tp', groupId } | null

function openCfgModal(target) {
  cfgEditing = target || null;
  $("#cfgFErr").classList.add("hidden");
  // Populate UP dropdown
  const upSel = $("#cfgFUp");
  upSel.innerHTML = `<option value="">(unlinked)</option>` +
    (window.UNIT_PROCESSES||[]).map(u => `<option value="${u.id}">${u.name}</option>`).join("");

  if (target && target.kind === "single") {
    const sp = (window.SETPOINTS||[]).find(s => s.id === target.spId);
    if (!sp) return;
    $("#cfgModalTitle").textContent = "Edit set point";
    $("#cfgFType").value = CFG_TYPES.find(t => t.type === sp.type) ? sp.type : "Level";
    $("#cfgFName").value = sp.name || "";
    $("#cfgFDesc").value = sp.description || "";
    const up = (window.UNIT_PROCESSES||[]).find(u => u.setpointIds?.includes(sp.id));
    upSel.value = up?.id || "";
    renderCfgSchema(sp.type, sp);
  } else if (target && target.kind === "tp") {
    const members = (window.SETPOINTS||[]).filter(s => s.groupId === target.groupId);
    if (!members.length) return;
    $("#cfgModalTitle").textContent = "Edit Transfer Pump Set Point";
    $("#cfgFType").value = "Transfer Pump";
    $("#cfgFName").value = members[0].groupName || "";
    $("#cfgFDesc").value = members[0].description || "";
    const up = (window.UNIT_PROCESSES||[]).find(u => u.setpointIds?.includes(members[0].id));
    upSel.value = up?.id || "";
    renderCfgSchema("Transfer Pump", { members });
  } else {
    $("#cfgModalTitle").textContent = "Add set point";
    $("#cfgFType").value = "Level";
    $("#cfgFName").value = "";
    $("#cfgFDesc").value = "";
    upSel.value = "";
    renderCfgSchema("Level", null);
  }
  updateCfgHmi();
  document.getElementById("cfgModal").classList.remove("hidden");
}
function closeCfgModal() { document.getElementById("cfgModal").classList.add("hidden"); cfgEditing = null; }

function renderCfgSchema(type, existing) {
  const host = $("#cfgFSchema");
  const unit = cfgUnitFor(type);
  if (type === "Transfer Pump") {
    const m = existing?.members || [];
    const get = (role, field) => m.find(x => x.subRole === role)?.[field];
    host.innerHTML = `
      <div class="cfg2-tp-block">
        <div class="cfg2-tp-title">Source Tank</div>
        <div class="cfg2-tp-row">
          <div class="cfg2-field"><label>Start (current)</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStart" value="${get("SOURCEMIN","current") ?? ""}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Start · safe min</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStartMin" value="${get("SOURCEMIN","min") ?? 0}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Start · safe max</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStartMax" value="${get("SOURCEMIN","max") ?? 100}"><span class="u">${unit}</span></div></div>
        </div>
        <div class="cfg2-tp-row" style="margin-top:6px">
          <div class="cfg2-field"><label>Stop (current)</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStop" value="${get("SOURCEMAX","current") ?? ""}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Stop · safe min</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStopMin" value="${get("SOURCEMAX","min") ?? 0}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Stop · safe max</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-srcStopMax" value="${get("SOURCEMAX","max") ?? 100}"><span class="u">${unit}</span></div></div>
        </div>
      </div>
      <div class="cfg2-tp-block">
        <div class="cfg2-tp-title">Destination Tank</div>
        <div class="cfg2-tp-row">
          <div class="cfg2-field"><label>Start (current)</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStart" value="${get("DESTMIN","current") ?? ""}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Start · safe min</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStartMin" value="${get("DESTMIN","min") ?? 0}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Start · safe max</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStartMax" value="${get("DESTMIN","max") ?? 100}"><span class="u">${unit}</span></div></div>
        </div>
        <div class="cfg2-tp-row" style="margin-top:6px">
          <div class="cfg2-field"><label>Stop (current)</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStop" value="${get("DESTMAX","current") ?? ""}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Stop · safe min</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStopMin" value="${get("DESTMAX","min") ?? 0}"><span class="u">${unit}</span></div></div>
          <div class="cfg2-field"><label>Stop · safe max</label>
            <div class="cfg2-input"><input type="number" step="any" id="cfgF-dstStopMax" value="${get("DESTMAX","max") ?? 100}"><span class="u">${unit}</span></div></div>
        </div>
      </div>
    `;
  } else {
    host.innerHTML = `
      <div class="cfg2-grid-2">
        <div class="cfg2-field"><label>Safe Min</label>
          <div class="cfg2-input"><input type="number" step="any" id="cfgF-min" value="${existing?.min ?? ""}"><span class="u">${unit}</span></div></div>
        <div class="cfg2-field"><label>Safe Max</label>
          <div class="cfg2-input"><input type="number" step="any" id="cfgF-max" value="${existing?.max ?? ""}"><span class="u">${unit}</span></div></div>
      </div>
      <div class="cfg2-grid-2">
        <div class="cfg2-field"><label>Current value</label>
          <div class="cfg2-input"><input type="number" step="any" id="cfgF-cur" value="${existing?.current ?? ""}"><span class="u">${unit}</span></div></div>
        <div class="cfg2-field"><label>Unit</label>
          <input type="text" id="cfgF-unit" value="${existing?.unit ?? unit}" />
        </div>
      </div>
    `;
  }
}

function updateCfgHmi() {
  const type = $("#cfgFType").value;
  const upId = $("#cfgFUp").value;
  const up = (window.UNIT_PROCESSES||[]).find(u => u.id === upId);
  const upName = up ? up.name : "GENERAL";
  const idx = (up?.setpointIds?.length || 0) + 1;
  if (type === "Transfer Pump") {
    const tags = ["SOURCEMIN","SOURCEMAX","DESTMIN","DESTMAX"]
      .map((r, i) => window.generateHmiTag(upName, "LT", idx + i, r));
    $("#cfgFHmi").innerHTML = tags.map(t => `<div>${t}</div>`).join("");
  } else {
    $("#cfgFHmi").textContent = window.generateHmiTag(upName, type, idx);
  }
}

function saveCfgModal() {
  const type  = $("#cfgFType").value;
  const name  = $("#cfgFName").value.trim();
  const desc  = $("#cfgFDesc").value.trim();
  const upId  = $("#cfgFUp").value;
  const up    = (window.UNIT_PROCESSES||[]).find(u => u.id === upId);
  const err   = $("#cfgFErr");
  err.classList.add("hidden");
  if (!name) { err.textContent = "Name is required"; err.classList.remove("hidden"); return; }

  if (type === "Transfer Pump") {
    const f = sel => parseFloat($("#cfgF-"+sel).value);
    const v = {
      srcStart: f("srcStart"), srcStartMin: f("srcStartMin"), srcStartMax: f("srcStartMax"),
      srcStop:  f("srcStop"),  srcStopMin:  f("srcStopMin"),  srcStopMax:  f("srcStopMax"),
      dstStart: f("dstStart"), dstStartMin: f("dstStartMin"), dstStartMax: f("dstStartMax"),
      dstStop:  f("dstStop"),  dstStopMin:  f("dstStopMin"),  dstStopMax:  f("dstStopMax"),
    };
    const problems = [];
    for (const k of Object.keys(v)) if (isNaN(v[k])) problems.push(`${k} required`);
    if (!problems.length) {
      if (v.srcStart > v.srcStop) problems.push("Source Tank: Start cannot be greater than Stop");
      if (v.dstStart > v.dstStop) problems.push("Destination Tank: Start cannot be greater than Stop");
      for (const role of [["srcStart","srcStartMin","srcStartMax"],["srcStop","srcStopMin","srcStopMax"],["dstStart","dstStartMin","dstStartMax"],["dstStop","dstStopMin","dstStopMax"]]) {
        const [c, mn, mx] = role;
        if (v[mn] > v[mx]) problems.push(`${c}: safe min > safe max`);
        if (v[c] < v[mn] || v[c] > v[mx]) problems.push(`${c}: current outside safe range`);
      }
    }
    if (problems.length) { err.textContent = problems.join(" · "); err.classList.remove("hidden"); return; }

    if (cfgEditing && cfgEditing.kind === "tp") {
      const members = (window.SETPOINTS||[]).filter(s => s.groupId === cfgEditing.groupId);
      const apply = (role, current, min, max) => {
        const m = members.find(x => x.subRole === role); if (!m) return;
        m.name = `${name} · ${role==="SOURCEMIN"?"Source Tank Start":role==="SOURCEMAX"?"Source Tank Stop":role==="DESTMIN"?"Destination Tank Start":"Destination Tank Stop"} Level`;
        m.description = desc; m.current = current; m.min = min; m.max = max; m.groupName = name;
      };
      apply("SOURCEMIN", v.srcStart, v.srcStartMin, v.srcStartMax);
      apply("SOURCEMAX", v.srcStop,  v.srcStopMin,  v.srcStopMax);
      apply("DESTMIN",   v.dstStart, v.dstStartMin, v.dstStartMax);
      apply("DESTMAX",   v.dstStop,  v.dstStopMin,  v.dstStopMax);
      toast(`Updated Transfer Pump · ${name}`, "ok");
    } else {
      const groupId = "lt-" + Date.now().toString(36);
      const idxStart = (up?.setpointIds?.length || 0) + 1;
      const upName = up?.name || "GENERAL";
      const make = (role, current, min, max, idx) => ({
        id: groupId + "-" + role.toLowerCase(),
        type: "LT", subRole: role,
        groupId, groupName: name, description: desc,
        name: `${name} · ${role==="SOURCEMIN"?"Source Tank Start":role==="SOURCEMAX"?"Source Tank Stop":role==="DESTMIN"?"Destination Tank Start":"Destination Tank Stop"} Level`,
        hmiTag: window.generateHmiTag(upName, "LT", idx, role),
        unit: "%", current, min, max, active: true,
        equipment: upName, targets: up ? [...(up.equipmentIds||[])] : [],
        source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
        history: [],
      });
      const items = [
        make("SOURCEMIN", v.srcStart, v.srcStartMin, v.srcStartMax, idxStart),
        make("SOURCEMAX", v.srcStop,  v.srcStopMin,  v.srcStopMax,  idxStart+1),
        make("DESTMIN",   v.dstStart, v.dstStartMin, v.dstStartMax, idxStart+2),
        make("DESTMAX",   v.dstStop,  v.dstStopMin,  v.dstStopMax,  idxStart+3),
      ];
      window.SETPOINTS = (window.SETPOINTS||[]).concat(items);
      if (up) { up.setpointIds = up.setpointIds || []; up.setpointIds.push(...items.map(i => i.id)); }
      toast(`Added Transfer Pump · ${name} (4 set points)`, "ok");
    }
  } else {
    const unit = $("#cfgF-unit")?.value || cfgUnitFor(type);
    const min = parseFloat($("#cfgF-min").value);
    const max = parseFloat($("#cfgF-max").value);
    const cur = parseFloat($("#cfgF-cur").value);
    const problems = [];
    if (isNaN(min) || isNaN(max)) problems.push("Safe Min and Safe Max are required");
    else if (max <= min) problems.push("Safe Max must be greater than Safe Min");
    if (isNaN(cur)) problems.push("Current value is required");
    else if (!isNaN(min) && !isNaN(max) && (cur < min || cur > max)) problems.push("Current must be within Safe Min–Max");
    if (problems.length) { err.textContent = problems.join(" · "); err.classList.remove("hidden"); return; }

    if (cfgEditing && cfgEditing.kind === "single") {
      const sp = (window.SETPOINTS||[]).find(s => s.id === cfgEditing.spId);
      if (sp) {
        Object.assign(sp, { type, name, description: desc, unit, min, max, current: cur });
        toast(`Updated · ${name}`, "ok");
      }
    } else {
      const id = "sp-" + Date.now().toString(36);
      const upName = up?.name || "GENERAL";
      const idx = (up?.setpointIds?.length || 0) + 1;
      const sp = {
        id, type, name, description: desc, unit, min, max, current: cur,
        hmiTag: window.generateHmiTag(upName, type, idx),
        active: true, equipment: upName, targets: up ? [...(up.equipmentIds||[])] : [],
        source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
        history: [],
      };
      (window.SETPOINTS||(window.SETPOINTS=[])).push(sp);
      if (up) { up.setpointIds = up.setpointIds || []; up.setpointIds.push(sp.id); }
      toast(`Added · ${name}`, "ok");
    }
  }
  closeCfgModal();
  renderCfgTable();
}

// =====================================================================
// LAYOUT-DRIVEN WIDGET RENDERING (shared by Dashboard, Drawer & Studio)
// =====================================================================
function renderWidget(w, ctx) {
  const node = document.createElement("div");
  node.className = "dash-w col-" + (w.col || 4);
  node.dataset.widgetId = w.id;
  if (w.type === "setpoint") {
    const sp = (window.SETPOINTS||[]).find(s => s.id === w.spId);
    if (!sp) { node.innerHTML = `<div class="w-note">Missing set point <code>${w.spId}</code></div>`; return node; }
    if (w.ltGroupId) {
      const group = ltGroupForSpId(w.spId);
      if (group) { node.appendChild(renderSetpointWidgetLt(group, ctx)); return node; }
    }
    node.appendChild(renderSetpointWidget(sp, ctx));
  } else if (w.type === "sensor") {
    const sen = (window.SENSORS||[]).find(s => s.id === w.sensorId);
    if (!sen) { node.innerHTML = `<div class="w-note">Missing sensor <code>${w.sensorId}</code></div>`; return node; }
    node.appendChild(renderSensorWidget(sen));
  } else if (w.type === "header") {
    node.innerHTML = `<div class="w-header"><div class="w-h-text">${w.text||"Section"}</div><div class="w-h-rule"></div></div>`;
  } else if (w.type === "divider") {
    node.innerHTML = `<div class="w-divider"></div>`;
  } else if (w.type === "note") {
    node.innerHTML = `<div class="w-note">${w.text||"Note"}</div>`;
  }
  return node;
}
function renderSetpointWidget(sp) {
  const wrap = document.createElement("div");
  wrap.className = "w-setpoint";
  const typeShort = (sp.type || "SP").split(" ")[0].slice(0,3).toUpperCase();
  wrap.innerHTML = `
    <div class="w-head">
      <div class="w-tile">${typeShort}</div>
      <div>
        <div class="w-name">${sp.name}</div>
        <div class="w-sub">${sp.type} · ${sp.equipment||""}</div>
      </div>
      <button class="w-bell" title="Notification preferences">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
      </button>
    </div>
    <div class="w-readout">
      <div class="w-readout-cell"><span class="lbl">CURRENT</span><span class="v">${sp.current} ${sp.unit}</span></div>
      <div class="w-readout-cell"><span class="lbl">SAFE RANGE</span><span class="v" style="color:var(--text-2)">${spRangeText(sp)}</span></div>
    </div>
    <div class="w-actions">
      <button class="dp-btn primary sm" data-w-edit>✎ Edit</button>
    </div>
  `;
  wrap.querySelector(".w-bell").addEventListener("click", e => { e.stopPropagation(); openNotifyPopover(sp); });
  wrap.querySelector("[data-w-edit]").addEventListener("click", e => { e.stopPropagation(); toast(`Edit ${sp.name} via the Unit Processes drawer`, "warn"); openSetPointsDrawer(); });
  return wrap;
}
function renderSetpointWidgetLt(group) {
  const wrap = document.createElement("div");
  wrap.className = "w-setpoint";
  const m = group.members; const u = m[0]?.unit || "%";
  const v = (role) => m.find(x => x.subRole === role)?.current ?? "—";
  wrap.innerHTML = `
    <div class="w-head">
      <div class="w-tile">LT</div>
      <div><div class="w-name">${group.groupName}</div><div class="w-sub">LT · 4 HMI tags</div></div>
      <button class="w-bell"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg></button>
    </div>
    <div class="w-readout">
      <div class="w-readout-cell"><span class="lbl">SOURCE</span><span class="v">${v("SOURCEMIN")} – ${v("SOURCEMAX")} ${u}</span></div>
      <div class="w-readout-cell"><span class="lbl">DESTINATION</span><span class="v">${v("DESTMIN")} – ${v("DESTMAX")} ${u}</span></div>
    </div>
    <div class="w-actions"><button class="dp-btn primary sm" data-w-edit-lt>✎ Edit all 4</button></div>
  `;
  wrap.querySelector(".w-bell").addEventListener("click", e => { e.stopPropagation(); openNotifyPopover(m[0]); });
  wrap.querySelector("[data-w-edit-lt]").addEventListener("click", e => { e.stopPropagation(); toast(`Edit ${group.groupName} via the Unit Processes drawer`, "warn"); openSetPointsDrawer(); });
  return wrap;
}
function renderSensorWidget(sen) {
  const wrap = document.createElement("div");
  wrap.className = "w-sensor";
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
      <span class="w-name">${sen.name}</span>
      <span class="live-dot"></span>
    </div>
    <code class="w-tag">${sen.tag}</code>
    <div class="w-value"><span class="v">${sen.value}</span><span class="u">${sen.unit}</span></div>
  `;
  return wrap;
}
function ltGroupForSpId(spId) {
  const sp = (window.SETPOINTS||[]).find(s => s.id === spId);
  if (!sp || sp.type !== "LT" || !sp.groupId) return null;
  const members = (window.SETPOINTS||[]).filter(s => s.groupId === sp.groupId);
  return { groupId: sp.groupId, groupName: sp.groupName, members };
}

// =====================================================================
// DASHBOARD (operator full-screen view)
// =====================================================================
function renderDashboard() {
  $("#dashVersion").textContent = window.LAYOUT_VERSION.version;
  $("#dashVersionDate").textContent = new Date(window.LAYOUT_VERSION.publishedAt).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  const filter = $("#dashFilter");
  const cur = filter.value;
  filter.innerHTML = `<option value="">All unit processes</option>` +
    (window.UNIT_PROCESSES||[]).map(up => `<option value="${up.id}" ${cur===up.id?"selected":""}>${up.name}</option>`).join("");
  filter.onchange = () => renderDashboard();
  const body = $("#dashBody"); body.innerHTML = "";
  const ups = (window.UNIT_PROCESSES||[]).filter(up => !cur || up.id === cur);
  if (!ups.length) { body.innerHTML = `<div class="up-empty">No unit processes.</div>`; return; }
  for (const up of ups) {
    const sec = document.createElement("div");
    sec.className = "dash-up";
    sec.innerHTML = `
      <div class="dash-up-head">
        <div class="dash-up-title">${up.name}</div>
        <div class="dash-up-meta">${up.equipmentIds.length} equipment · ${(up.layout||[]).length} widget${(up.layout||[]).length===1?"":"s"}</div>
      </div>
      <div class="dash-grid" data-up-grid></div>
    `;
    const grid = sec.querySelector("[data-up-grid]");
    if (!(up.layout||[]).length) {
      grid.innerHTML = `<div class="canvas-empty" style="grid-column:span 12">No widgets configured. Open Studio to add some.</div>`;
    } else {
      for (const w of up.layout) grid.appendChild(renderWidget(w, {readonly:true}));
    }
    body.appendChild(sec);
  }
}

// =====================================================================
// STUDIO (implementer builder)
// =====================================================================
let studioSelectedUpId = null;
let studioSelectedWidgetId = null;

function renderStudio() {
  $("#studioVersion").textContent = window.LAYOUT_VERSION.version;
  if (!studioSelectedUpId && (window.UNIT_PROCESSES||[]).length) studioSelectedUpId = window.UNIT_PROCESSES[0].id;
  renderStudioUpList();
  renderStudioCanvas();
  renderStudioInspector();
}
function renderStudioUpList() {
  const host = $("#studioUpList"); host.innerHTML = "";
  for (const up of (window.UNIT_PROCESSES||[])) {
    const el = document.createElement("button");
    el.className = "palette-up" + (up.id === studioSelectedUpId ? " active" : "");
    el.innerHTML = `<span>${up.name}</span><span class="pu-count">${(up.layout||[]).length}w</span>`;
    el.addEventListener("click", () => { studioSelectedUpId = up.id; studioSelectedWidgetId = null; renderStudio(); });
    host.appendChild(el);
  }
}
function studioSelectedUp() { return (window.UNIT_PROCESSES||[]).find(u => u.id === studioSelectedUpId); }
function studioSelectedWidget() { const up = studioSelectedUp(); if (!up) return null; return (up.layout||[]).find(w => w.id === studioSelectedWidgetId); }

function renderStudioCanvas() {
  const up = studioSelectedUp();
  if (!up) { $("#studioCanvas").innerHTML = `<div class="canvas-empty">No unit process selected.</div>`; return; }
  $("#studioUpName").value = up.name;
  $("#studioUpEquipCount").textContent = `${up.equipmentIds.length} equipment`;
  $("#studioUpSpCount").textContent = `${(up.layout||[]).length} widgets`;

  const canvas = $("#studioCanvas");
  canvas.innerHTML = "";
  if (!up.layout || !up.layout.length) {
    canvas.innerHTML = `<div class="canvas-empty">Drag a widget from the palette to start arranging this unit process.</div>`;
  } else {
    for (const w of up.layout) {
      const cell = renderWidget(w, {studio:true});
      cell.classList.add("canvas-w", "col-"+(w.col||4));
      cell.classList.remove("dash-w");
      cell.dataset.widgetId = w.id;
      cell.draggable = true;
      if (w.id === studioSelectedWidgetId) cell.classList.add("selected");
      const actions = document.createElement("div");
      actions.className = "canvas-w-actions";
      actions.innerHTML = `<button title="Move up">↑</button><button title="Move down">↓</button><button class="del" title="Delete">✕</button>`;
      cell.appendChild(actions);
      actions.children[0].addEventListener("click", e => { e.stopPropagation(); moveWidget(up, w.id, -1); });
      actions.children[1].addEventListener("click", e => { e.stopPropagation(); moveWidget(up, w.id, +1); });
      actions.children[2].addEventListener("click", e => { e.stopPropagation(); deleteWidget(up, w.id); });
      cell.addEventListener("click", e => { e.stopPropagation(); studioSelectedWidgetId = w.id; renderStudio(); });
      cell.addEventListener("dragstart", e => { e.dataTransfer.effectAllowed="copyMove"; e.dataTransfer.setData("text/widget", w.id); cell.classList.add("dragging"); });
      cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
      cell.addEventListener("dragover", e => {
        e.preventDefault();
        const t = e.dataTransfer.types;
        e.dataTransfer.dropEffect = t.includes("text/widget-type") ? "copy" : "move";
      });
      cell.addEventListener("drop", e => {
        e.preventDefault(); e.stopPropagation();
        const movedId = e.dataTransfer.getData("text/widget");
        const newType = e.dataTransfer.getData("text/widget-type");
        if (movedId) reorderWidget(up, movedId, w.id);
        else if (newType) insertNewWidget(up, newType, w.id);
      });
      canvas.appendChild(cell);
    }
  }
  canvas.addEventListener("dragover", e => {
    e.preventDefault();
    const t = e.dataTransfer.types;
    e.dataTransfer.dropEffect = t.includes("text/widget-type") ? "copy" : "move";
    canvas.classList.add("drop-target");
  });
  canvas.addEventListener("dragleave", () => canvas.classList.remove("drop-target"));
  canvas.addEventListener("drop", e => {
    e.preventDefault(); canvas.classList.remove("drop-target");
    const newType = e.dataTransfer.getData("text/widget-type");
    if (newType) insertNewWidget(up, newType, null);
  });
}
function reorderWidget(up, movedId, targetId) {
  const arr = up.layout;
  const fromIdx = arr.findIndex(w => w.id === movedId);
  const toIdx   = arr.findIndex(w => w.id === targetId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const [item] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, item);
  renderStudio();
}
function moveWidget(up, id, dir) {
  const arr = up.layout;
  const i = arr.findIndex(w => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderStudio();
}
function deleteWidget(up, id) {
  up.layout = (up.layout||[]).filter(w => w.id !== id);
  if (studioSelectedWidgetId === id) studioSelectedWidgetId = null;
  renderStudio();
}
function insertNewWidget(up, type, beforeId) {
  const newW = { id: "w-" + Date.now().toString(36), type, col: (type==="header"||type==="divider"||type==="note") ? 12 : 6 };
  if (type === "header") newW.text = "New section";
  if (type === "note")   newW.text = "Add your note here.";
  if (type === "setpoint") {
    // Auto-create a blank setpoint and assign — editable immediately in the inspector
    const spId = "sp-new-" + Date.now().toString(36);
    const newSp = {
      id: spId, type: "Custom",
      name: "New set point",
      hmiTag: window.generateHmiTag(up.name, "Custom", (up.setpointIds?.length||0)+1),
      unit: "", current: 0, min: 0, max: 100,
      active: true, equipment: up.name, targets: [...(up.equipmentIds||[])],
      source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
      history: [],
    };
    (window.SETPOINTS||(window.SETPOINTS=[])).push(newSp);
    up.setpointIds = up.setpointIds || []; up.setpointIds.push(spId);
    newW.spId = spId;
  }
  if (type === "sensor") {
    // Auto-create a blank sensor
    const senId = "sen-new-" + Date.now().toString(36);
    const tagBase = (up.name||"UP").toUpperCase().replace(/[^A-Z0-9]+/g,"_");
    const newSen = { id: senId, name: "New sensor", tag: `${tagBase}.LIVE_${Date.now().toString(36).slice(-3).toUpperCase()}`, unit: "", value: 0 };
    (window.SENSORS||(window.SENSORS=[])).push(newSen);
    newW.sensorId = senId;
  }
  up.layout = up.layout || [];
  if (beforeId) {
    const idx = up.layout.findIndex(w => w.id === beforeId);
    up.layout.splice(idx, 0, newW);
  } else up.layout.push(newW);
  studioSelectedWidgetId = newW.id;
  renderStudio();
}

const SP_TYPE_PRESETS = [
  { type: "DO",                unit: "mg/L" },
  { type: "PT",                unit: "bar"  },
  { type: "LT",                unit: "%"    },
  { type: "Flow",              unit: "m³/hr"},
  { type: "Switchover Time",   unit: "min"  },
  { type: "Time",              unit: "min"  },
  { type: "Level",             unit: "%"    },
  { type: "Pressure",          unit: "bar"  },
  { type: "Conductivity",      unit: "μS/cm"},
  { type: "ORP",               unit: "mV"   },
  { type: "FRC",               unit: "ppm"  },
  { type: "pH",                unit: "pH"   },
  { type: "Custom",            unit: ""     },
];

function renderStudioInspector() {
  const host = $("#studioInspector");
  const up = studioSelectedUp();
  const w = studioSelectedWidget();
  if (!w) { host.innerHTML = `<div class="insp-empty">Pick a widget to edit its properties — or drag a tile from the palette to add one.</div>`; return; }
  let body = `
    <div class="insp-section"><span class="insp-label">Widget · ${w.type}</span></div>
    <div class="insp-section">
      <span class="insp-label">Width (columns)</span>
      <div class="insp-cols">
        ${[2,3,4,6,8,12].map(c => `<button class="insp-col-btn ${w.col===c?"active":""}" data-col="${c}">${c}</button>`).join("")}
      </div>
    </div>`;

  if (w.type === "setpoint") {
    body += renderInspectorSetpoint(w, up);
  } else if (w.type === "sensor") {
    body += renderInspectorSensor(w, up);
  } else if (w.type === "header" || w.type === "note") {
    body += `<div class="insp-section"><span class="insp-label">Text</span>
      <textarea data-f="text" rows="${w.type==="note"?3:2}">${w.text||""}</textarea></div>`;
  }

  body += `<div class="insp-section" style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">
    <button class="dp-btn ghost sm danger" data-w-delete>Delete widget</button>
  </div>`;
  host.innerHTML = body;

  // Common wiring
  host.querySelectorAll(".insp-col-btn").forEach(b => b.addEventListener("click", () => { w.col = parseInt(b.dataset.col, 10); renderStudio(); }));
  host.querySelectorAll("textarea[data-f]").forEach(el => el.addEventListener("input", () => { w[el.dataset.f] = el.value; }));
  host.querySelector("[data-w-delete]")?.addEventListener("click", () => deleteWidget(up, w.id));

  // Setpoint-specific wiring
  if (w.type === "setpoint") wireInspectorSetpoint(host, w, up);
  if (w.type === "sensor")   wireInspectorSensor(host, w, up);
}

// ============ SET POINT EDITOR (inside Studio inspector) ============
function renderInspectorSetpoint(w, up) {
  const sp = (window.SETPOINTS||[]).find(s => s.id === w.spId);
  const allSps = (window.SETPOINTS||[]);
  let html = `
    <div class="insp-section">
      <span class="insp-label">Linked set point</span>
      <select data-f="spId">
        <option value="">— Pick existing —</option>
        ${allSps.map(s => `<option value="${s.id}" ${w.spId===s.id?"selected":""}>${s.name}</option>`).join("")}
      </select>
    </div>
    <div class="insp-section">
      <button class="dp-btn ghost sm" data-action="new-sp" style="width:100%">+ Create blank set point</button>
    </div>
  `;
  if (sp) {
    html += `
      <div class="insp-edit-block">
        <div class="insp-edit-head"><span class="insp-label">Set point details</span></div>
        <div class="insp-row"><label>Name</label><input type="text" data-sp="name" value="${escAttr(sp.name)}"/></div>
        <div class="insp-row"><label>Type</label>
          <select data-sp="type">
            ${SP_TYPE_PRESETS.map(p => `<option value="${p.type}" ${sp.type===p.type?"selected":""}>${p.type}</option>`).join("")}
          </select>
        </div>
        <div class="insp-row"><label>Unit</label><input type="text" data-sp="unit" value="${escAttr(sp.unit||"")}" placeholder="e.g. mg/L, m³/hr, bar"/></div>
        <div class="insp-grid-2">
          <div class="insp-row"><label>Min</label><input type="number" step="any" data-sp="min" value="${sp.min ?? ""}"/></div>
          <div class="insp-row"><label>Max</label><input type="number" step="any" data-sp="max" value="${sp.max ?? ""}"/></div>
        </div>
        <div class="insp-row"><label>Current value</label><input type="number" step="any" data-sp="current" value="${sp.current ?? ""}"/></div>
        <div class="insp-row"><label>HMI tag <small>auto-generated</small></label>
          <div class="insp-hmi-chip"><code>${sp.hmiTag||"—"}</code></div>
        </div>
        <div class="insp-err hidden" data-sp-err></div>
        <div class="insp-section" style="display:flex;gap:6px;margin-top:8px">
          <button class="dp-btn primary sm" data-action="save-sp" style="flex:1">Save set point</button>
          <button class="dp-btn ghost sm danger" data-action="delete-sp" title="Delete this set point from the system">🗑</button>
        </div>
      </div>
    `;
  }
  return html;
}

function wireInspectorSetpoint(host, w, up) {
  host.querySelector('select[data-f="spId"]')?.addEventListener("change", e => {
    w.spId = e.target.value;
    renderStudio();
  });
  host.querySelector('[data-action="new-sp"]')?.addEventListener("click", () => {
    // Create blank setpoint and assign
    const spId = "sp-new-" + Date.now().toString(36);
    const newSp = {
      id: spId, type: "Custom",
      name: "New set point",
      hmiTag: window.generateHmiTag(up.name, "Custom", (up.setpointIds?.length||0)+1),
      unit: "", current: 0, min: 0, max: 100,
      active: true, equipment: up.name, targets: [...(up.equipmentIds||[])],
      source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
      history: [],
    };
    (window.SETPOINTS||(window.SETPOINTS=[])).push(newSp);
    up.setpointIds = up.setpointIds || []; if (!up.setpointIds.includes(spId)) up.setpointIds.push(spId);
    w.spId = spId;
    renderStudio();
  });
  host.querySelector('[data-action="save-sp"]')?.addEventListener("click", () => saveSpFromInspector(host, w, up));
  host.querySelector('[data-action="delete-sp"]')?.addEventListener("click", () => deleteSpFromInspector(w, up));
}

function saveSpFromInspector(host, w, up) {
  const sp = (window.SETPOINTS||[]).find(s => s.id === w.spId); if (!sp) return;
  const get = sel => host.querySelector(`[data-sp="${sel}"]`)?.value;
  const name = (get("name")||"").trim();
  const type = get("type") || "Custom";
  const unit = (get("unit")||"").trim();
  const min  = parseFloat(get("min"));
  const max  = parseFloat(get("max"));
  const cur  = parseFloat(get("current"));
  const err  = host.querySelector("[data-sp-err]");
  const problems = [];
  if (!name) problems.push("Name is required");
  if (isNaN(min) || isNaN(max)) problems.push("Min and Max must be numbers");
  else if (max <= min) problems.push("Max must be greater than Min");
  if (isNaN(cur)) problems.push("Current must be a number");
  else if (!isNaN(min) && !isNaN(max) && (cur < min || cur > max)) problems.push("Current must be within Min–Max");
  if (problems.length) {
    err.textContent = problems.join(" · ");
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");
  // History
  const changes = {};
  if (sp.name !== name) changes.name = { from: sp.name, to: name };
  if (sp.type !== type) changes.type = { from: sp.type, to: type };
  if (sp.unit !== unit) changes.unit = { from: sp.unit, to: unit };
  if (sp.min  !== min)  changes.min  = { from: sp.min,  to: min  };
  if (sp.max  !== max)  changes.max  = { from: sp.max,  to: max  };
  if (sp.current !== cur) changes.current = { from: sp.current, to: cur };
  if (Object.keys(changes).length) {
    sp.history = sp.history || [];
    sp.history.push({ ts: new Date().toISOString(), kind: "config", changes, who: "you" });
  }
  Object.assign(sp, { name, type, unit, min, max, current: cur });
  // Refresh HMI tag if type changed
  sp.hmiTag = window.generateHmiTag(up.name, type, (up.setpointIds.indexOf(sp.id) >= 0 ? up.setpointIds.indexOf(sp.id) + 1 : 1));
  toast(`Saved · ${name}`, "ok");
  renderStudio();
}

function deleteSpFromInspector(w, up) {
  const sp = (window.SETPOINTS||[]).find(s => s.id === w.spId); if (!sp) return;
  if (!confirm(`Delete set point "${sp.name}" from the system? This removes it from every dashboard that uses it.`)) return;
  // Remove from all UP setpointIds + layouts
  for (const u of (window.UNIT_PROCESSES||[])) {
    u.setpointIds = (u.setpointIds||[]).filter(id => id !== sp.id);
    u.layout = (u.layout||[]).filter(wgt => wgt.spId !== sp.id);
  }
  // Remove from global list
  window.SETPOINTS = (window.SETPOINTS||[]).filter(s => s.id !== sp.id);
  studioSelectedWidgetId = null;
  toast(`Deleted set point · ${sp.name}`, "ok");
  renderStudio();
}

// ============ SENSOR EDITOR (inside Studio inspector) ============
function renderInspectorSensor(w, up) {
  const sen = (window.SENSORS||[]).find(s => s.id === w.sensorId);
  const all = (window.SENSORS||[]);
  let html = `
    <div class="insp-section">
      <span class="insp-label">Linked sensor</span>
      <select data-f="sensorId">
        <option value="">— Pick existing —</option>
        ${all.map(s => `<option value="${s.id}" ${w.sensorId===s.id?"selected":""}>${s.name} · ${s.tag}</option>`).join("")}
      </select>
    </div>
    <div class="insp-section">
      <button class="dp-btn ghost sm" data-action="new-sensor" style="width:100%">+ Create blank sensor</button>
    </div>
  `;
  if (sen) {
    html += `
      <div class="insp-edit-block">
        <div class="insp-edit-head"><span class="insp-label">Sensor details</span></div>
        <div class="insp-row"><label>Name</label><input type="text" data-sen="name" value="${escAttr(sen.name)}"/></div>
        <div class="insp-row"><label>HMI tag</label><input type="text" data-sen="tag" value="${escAttr(sen.tag)}" placeholder="e.g. AIT_201.LIVE"/></div>
        <div class="insp-row"><label>Unit</label><input type="text" data-sen="unit" value="${escAttr(sen.unit||"")}" placeholder="e.g. mg/L"/></div>
        <div class="insp-row"><label>Mock value</label><input type="number" step="any" data-sen="value" value="${sen.value ?? ""}"/></div>
        <div class="insp-section" style="display:flex;gap:6px;margin-top:8px">
          <button class="dp-btn primary sm" data-action="save-sen" style="flex:1">Save sensor</button>
          <button class="dp-btn ghost sm danger" data-action="delete-sen" title="Delete this sensor">🗑</button>
        </div>
      </div>
    `;
  }
  return html;
}

function wireInspectorSensor(host, w, up) {
  host.querySelector('select[data-f="sensorId"]')?.addEventListener("change", e => {
    w.sensorId = e.target.value; renderStudio();
  });
  host.querySelector('[data-action="new-sensor"]')?.addEventListener("click", () => {
    const id = "sen-new-" + Date.now().toString(36);
    const tagBase = (up.name||"UP").toUpperCase().replace(/[^A-Z0-9]+/g,"_");
    const newSen = { id, name: "New sensor", tag: `${tagBase}.LIVE_${Date.now().toString(36).slice(-3).toUpperCase()}`, unit: "", value: 0 };
    (window.SENSORS||(window.SENSORS=[])).push(newSen);
    w.sensorId = id;
    renderStudio();
  });
  host.querySelector('[data-action="save-sen"]')?.addEventListener("click", () => {
    const sen = (window.SENSORS||[]).find(s => s.id === w.sensorId); if (!sen) return;
    const get = sel => host.querySelector(`[data-sen="${sel}"]`)?.value;
    sen.name = (get("name")||"").trim() || sen.name;
    sen.tag  = (get("tag") ||"").trim() || sen.tag;
    sen.unit = (get("unit")||"").trim();
    const v = parseFloat(get("value")); if (!isNaN(v)) sen.value = v;
    toast(`Saved · ${sen.name}`, "ok");
    renderStudio();
  });
  host.querySelector('[data-action="delete-sen"]')?.addEventListener("click", () => {
    const sen = (window.SENSORS||[]).find(s => s.id === w.sensorId); if (!sen) return;
    if (!confirm(`Delete sensor "${sen.name}"? This removes it from every dashboard.`)) return;
    for (const u of (window.UNIT_PROCESSES||[])) {
      u.layout = (u.layout||[]).filter(wgt => wgt.sensorId !== sen.id);
    }
    window.SENSORS = (window.SENSORS||[]).filter(s => s.id !== sen.id);
    studioSelectedWidgetId = null;
    toast(`Deleted sensor · ${sen.name}`, "ok");
    renderStudio();
  });
}

function escAttr(s) { return String(s||"").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

function installPaletteDrag() {
  document.querySelectorAll(".palette-widget").forEach(el => {
    el.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("text/widget-type", el.dataset.add);
    });
  });
}
function studioPublish() {
  window.LAYOUT_VERSION = { version: (window.LAYOUT_VERSION.version || 0) + 1, publishedAt: new Date().toISOString() };
  toast(`Published v${window.LAYOUT_VERSION.version} · operators will see a refresh nudge`, "ok");
  renderStudio();
  showVersionNudge();
}
function showVersionNudge() {
  const n = document.getElementById("versionNudge");
  if (!n) return;
  n.classList.remove("hidden");
}
function studioAddUp() {
  const id = "up-" + Date.now().toString(36);
  (window.UNIT_PROCESSES||[]).push({ id, name: "New unit process", description:"", equipmentIds: [], setpointIds: [], layout: [] });
  studioSelectedUpId = id; studioSelectedWidgetId = null;
  renderStudio();
}
function studioDeleteUp() {
  const up = studioSelectedUp(); if (!up) return;
  if (!confirm(`Delete unit process "${up.name}" and its ${(up.layout||[]).length} widgets?`)) return;
  window.UNIT_PROCESSES = (window.UNIT_PROCESSES||[]).filter(u => u.id !== up.id);
  studioSelectedUpId = (window.UNIT_PROCESSES||[])[0]?.id || null;
  studioSelectedWidgetId = null;
  renderStudio();
}
function openEquipPicker() {
  const up = studioSelectedUp(); if (!up) return;
  const list = document.getElementById("equipPickerList");
  list.innerHTML = "";
  for (const id of Object.keys(DEVICES)) {
    const dev = DEVICES[id];
    const checked = up.equipmentIds.includes(id);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ms-item" + (checked ? " selected" : "");
    item.dataset.id = id;
    item.innerHTML = `<span class="ms-check">${checked?'✓':''}</span><span class="ms-name">${dev.name}</span>`;
    item.addEventListener("click", () => {
      item.classList.toggle("selected");
      item.querySelector(".ms-check").textContent = item.classList.contains("selected") ? "✓" : "";
    });
    list.appendChild(item);
  }
  document.getElementById("equipPickerModal").classList.remove("hidden");
}
function saveEquipPicker() {
  const up = studioSelectedUp(); if (!up) return;
  up.equipmentIds = Array.from(document.querySelectorAll("#equipPickerList .ms-item.selected")).map(b => b.dataset.id);
  document.getElementById("equipPickerModal").classList.add("hidden");
  renderStudio();
}

// =====================================================================
// Set Points drawer (button-launched, side panel)
// =====================================================================
let spDrawerFilters = { search: "", type: "" };

function openSetPointsDrawer() {
  document.getElementById("setPointsPanel").classList.remove("hidden");
  document.getElementById("dpMain").classList.add("side-open");
  document.body.classList.add("side-drawer-open");
  renderSpDrawer();
}
function closeSetPointsDrawer() {
  document.getElementById("setPointsPanel").classList.add("hidden");
  if (document.getElementById("groupPanel").classList.contains("hidden")) {
    document.getElementById("dpMain").classList.remove("side-open");
    document.body.classList.remove("side-drawer-open");
  }
}
let configMode = false;

function renderSpDrawer() {
  const body = $("#spDrawerBody"); if (!body) return;
  const ups = window.UNIT_PROCESSES || [];
  const allSps = window.SETPOINTS || [];
  $("#spDrawerCount").textContent = ups.length;
  if ($("#spCount")) $("#spCount").textContent = allSps.length;

  const search = (spDrawerFilters.search || "").toLowerCase();
  const filteredUps = ups.filter(up => {
    if (!search) return true;
    if (up.name.toLowerCase().includes(search)) return true;
    return up.setpointIds.some(spid => {
      const sp = allSps.find(s => s.id === spid);
      return sp && ((sp.name + " " + (sp.hmiTag||"") + " " + sp.type).toLowerCase().includes(search));
    });
  });
  body.innerHTML = "";
  if (!filteredUps.length) {
    body.innerHTML = `<div class="sp-drawer-empty">No unit processes match this search.</div>`;
    return;
  }
  for (const up of filteredUps) body.appendChild(renderUpCard(up));

  // Config mode footer: + Add unit process (not implemented; placeholder note)
  if (configMode) {
    const foot = document.createElement("div");
    foot.className = "up-config-foot";
    foot.innerHTML = `<span>Unit processes are detected automatically by the platform algorithm. Edit equipment & set points per unit process inside each card.</span>`;
    body.appendChild(foot);
  }
}

function renderUpCard(up) {
  const card = document.createElement("div");
  card.className = "up-card";
  card.dataset.upId = up.id;
  const setpoints = up.setpointIds.map(id => (window.SETPOINTS||[]).find(s=>s.id===id)).filter(Boolean);
  card.innerHTML = `
    <div class="up-head" data-up-toggle>
      <div class="up-tile">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      </div>
      <div class="up-meta">
        <div class="up-name">${up.name}</div>
        <div class="up-sub"><b>${up.equipmentIds.length}</b> equipment · <b>${setpoints.length}</b> set point${setpoints.length===1?"":"s"}</div>
      </div>
      <span class="up-chev" aria-hidden="true">▾</span>
    </div>
    <div class="up-expand">
      <p class="up-desc">${up.description||""}</p>
      <div class="up-section-row">
        <div class="up-section-label">Equipment</div>
        ${configMode ? `<button class="up-add-eq" data-add-eq>+ Add equipment</button>` : ""}
      </div>
      <div class="up-equip" data-equip-chips></div>
      <div class="up-section-row">
        <div class="up-section-label">Set Points</div>
        ${configMode ? `<button class="up-add-sp" data-add-sp>+ Add set point</button>` : ""}
      </div>
      <div class="up-sp-list" data-sp-list></div>
    </div>
  `;
  card.querySelector("[data-up-toggle]").addEventListener("click", () => toggleUpCard(card, up));
  return card;
}

function toggleUpCard(card, up) {
  const isOpen = card.classList.contains("expanded");
  // Close peers
  document.querySelectorAll(".up-card.expanded").forEach(c => { if (c !== card) c.classList.remove("expanded"); });
  if (isOpen) { card.classList.remove("expanded"); return; }
  card.classList.add("expanded");
  populateUpExpansion(card, up);
}

function populateUpExpansion(card, up) {
  // Equipment chips
  const equipHost = card.querySelector("[data-equip-chips]");
  equipHost.innerHTML = "";
  for (const eqId of up.equipmentIds) {
    const dev = DEVICES[eqId];
    const chip = document.createElement("span");
    chip.className = "up-equip-chip";
    chip.innerHTML = `<span>${dev?dev.name:eqId}</span>${configMode?`<button class="chip-x" data-remove-eq="${eqId}" title="Remove">✕</button>`:""}`;
    equipHost.appendChild(chip);
  }
  if (configMode) {
    equipHost.querySelectorAll("[data-remove-eq]").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const id = b.dataset.removeEq;
      up.equipmentIds = up.equipmentIds.filter(x => x !== id);
      populateUpExpansion(card, up);
      // Update counts
      card.querySelector(".up-sub").innerHTML = `<b>${up.equipmentIds.length}</b> equipment · <b>${up.setpointIds.length}</b> set point${up.setpointIds.length===1?"":"s"}`;
    }));
    card.querySelector("[data-add-eq]")?.addEventListener("click", e => { e.stopPropagation(); openAddEquipmentPopover(card, up); });
  }

  // Set point cards (nested) — LT setpoints with the same groupId render as ONE card
  const spList = card.querySelector("[data-sp-list]");
  spList.innerHTML = "";
  const setpoints = up.setpointIds.map(id => (window.SETPOINTS||[]).find(s=>s.id===id)).filter(Boolean);
  if (!setpoints.length) {
    spList.innerHTML = `<div class="up-empty">No set points configured.${configMode ? "" : " Switch to Configure to add some."}</div>`;
  } else {
    // Group LT setpoints by groupId
    const groupedItems = [];
    const ltGroups = {};
    for (const sp of setpoints) {
      if (sp.type === "LT" && sp.groupId) {
        if (!ltGroups[sp.groupId]) {
          ltGroups[sp.groupId] = { isLtGroup: true, groupId: sp.groupId, groupName: sp.groupName, members: [] };
          groupedItems.push(ltGroups[sp.groupId]);
        }
        ltGroups[sp.groupId].members.push(sp);
      } else {
        groupedItems.push(sp);
      }
    }
    for (const item of groupedItems) {
      if (item.isLtGroup) spList.appendChild(renderLtGroupCard(item, up));
      else spList.appendChild(renderSpdCard(item, up));
    }
  }
  if (configMode) {
    card.querySelector("[data-add-sp]")?.addEventListener("click", e => { e.stopPropagation(); openAddSetpointForm(card, up); });
  }
}

function stepFor(unit) {
  if (unit === "mg/L" || unit === "bar" || unit === "ppm") return 0.1;
  if (unit === "m") return 0.1;
  return 1;
}

function spLiveText(sp) {
  return `${sp.current} ${sp.unit}`;
}

function spRangeText(sp) {
  if (sp.type === "PT") return `${sp.min==null?"—":sp.min} – ${sp.max} ${sp.unit}`;
  if (sp.type === "Switchover Time") return `up to ${sp.max} ${sp.unit}`;
  return `${sp.min} – ${sp.max} ${sp.unit}`;
}

function renderSpdCard(sp, up) {
  const card = document.createElement("div");
  card.className = "spd-card" + (sp.active ? "" : " disabled");
  card.dataset.spId = sp.id;
  const typeShort = sp.type.split(" ")[0].slice(0,3).toUpperCase();
  card.innerHTML = `
    <div class="spd-card-head">
      <div class="spd-tile">${typeShort}</div>
      <div class="spd-meta">
        <div class="spd-name">${sp.name}</div>
        <div class="spd-eq">${sp.type}</div>
      </div>
      <div class="spd-head-actions">
        <button class="ic-pill" title="Notification preferences" data-sp-notify>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
        </button>
        ${configMode ? `<button class="ic-pill danger" title="Delete set point" data-sp-delete>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : ""}
      </div>
    </div>
    <div class="spd-hmi"><span class="lbl">HMI</span><code>${sp.hmiTag||"—"}</code></div>
    <div class="spd-readout">
      <div class="spd-readout-cell">
        <span class="lbl">CURRENT</span>
        <span class="v">${spLiveText(sp)}</span>
      </div>
      <div class="spd-readout-cell">
        <span class="lbl">SAFE RANGE</span>
        <span class="v muted">${spRangeText(sp)}</span>
      </div>
    </div>
    <div class="spd-card-actions">
      <button class="dp-btn primary sm" data-spd-edit ${sp.active?"":"disabled"}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        Edit
      </button>
    </div>
    <div class="spd-expand"></div>
  `;
  card.querySelector("[data-spd-edit]")?.addEventListener("click", e => { e.stopPropagation(); toggleSpdCard(card, sp); });
  card.querySelector("[data-sp-notify]")?.addEventListener("click", e => { e.stopPropagation(); openNotifyPopover(sp); });
  card.querySelector("[data-sp-delete]")?.addEventListener("click", e => { e.stopPropagation(); deleteSpFromUp(sp, up); });
  return card;
}

function deleteSpFromUp(sp, up) {
  if (!confirm(`Delete "${sp.name}" from ${up.name}?`)) return;
  up.setpointIds = up.setpointIds.filter(id => id !== sp.id);
  window.SETPOINTS = (window.SETPOINTS||[]).filter(s => s.id !== sp.id);
  toast(`Deleted ${sp.name}`, "ok");
  renderSpDrawer();
}

// ---------------- LT GROUP CARD (renders 4 LT setpoints as one) ----------------
const LT_ROLE_LABEL = {
  SOURCEMIN: "Source Tank · Min",
  SOURCEMAX: "Source Tank · Max",
  DESTMIN:   "Destination Tank · Min",
  DESTMAX:   "Destination Tank · Max",
};
function _byRole(members, role) { return members.find(m => m.subRole === role); }

function renderLtGroupCard(group, up) {
  const card = document.createElement("div");
  card.className = "spd-card lt-group-card";
  card.dataset.groupId = group.groupId;
  const m = group.members;
  const srcMin = _byRole(m, "SOURCEMIN"), srcMax = _byRole(m, "SOURCEMAX");
  const dstMin = _byRole(m, "DESTMIN"),   dstMax = _byRole(m, "DESTMAX");
  const anyActive = m.some(s => s.active);
  const u = m[0]?.unit || "%";
  card.innerHTML = `
    <div class="spd-card-head">
      <div class="spd-tile">LT</div>
      <div class="spd-meta">
        <div class="spd-name">${group.groupName}</div>
        <div class="spd-eq">LT · 4 set points</div>
      </div>
      <div class="spd-head-actions">
        <button class="ic-pill" title="Notification preferences" data-lt-notify>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
        </button>
        ${configMode ? `<button class="ic-pill danger" title="Delete group" data-lt-delete>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : ""}
      </div>
    </div>

    <div class="lt-hmi-block">
      <div class="lt-hmi-label">4 HMI TAGS · AUTO-GENERATED</div>
      ${m.map(sp => `<div class="lt-hmi-line"><code>${sp.hmiTag}</code><span class="muted">· ${LT_ROLE_LABEL[sp.subRole]||sp.subRole}</span></div>`).join("")}
    </div>

    <div class="lt-readout">
      <div class="lt-tank-block">
        <div class="lt-tank-title">SOURCE TANK</div>
        <div class="lt-row"><span class="lt-row-lbl">Min</span><span class="lt-row-val">${srcMin?.current ?? "—"} ${u}</span></div>
        <div class="lt-row"><span class="lt-row-lbl">Max</span><span class="lt-row-val">${srcMax?.current ?? "—"} ${u}</span></div>
      </div>
      <div class="lt-tank-block">
        <div class="lt-tank-title">DESTINATION TANK</div>
        <div class="lt-row"><span class="lt-row-lbl">Min</span><span class="lt-row-val">${dstMin?.current ?? "—"} ${u}</span></div>
        <div class="lt-row"><span class="lt-row-lbl">Max</span><span class="lt-row-val">${dstMax?.current ?? "—"} ${u}</span></div>
      </div>
    </div>

    <div class="spd-card-actions">
      <button class="dp-btn primary sm" data-lt-edit ${anyActive?"":"disabled"}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        Edit
      </button>
    </div>
    <div class="spd-expand"></div>
  `;
  card.querySelector("[data-lt-edit]")?.addEventListener("click", e => { e.stopPropagation(); toggleLtGroupCard(card, group); });
  card.querySelector("[data-lt-notify]")?.addEventListener("click", e => { e.stopPropagation(); openNotifyPopover(m[0]); });
  card.querySelector("[data-lt-delete]")?.addEventListener("click", e => { e.stopPropagation(); deleteLtGroup(group, up); });
  return card;
}

function toggleLtGroupCard(card, group) {
  const isOpen = card.classList.contains("expanded");
  document.querySelectorAll(".spd-card.expanded").forEach(c => {
    if (c !== card) {
      c.classList.remove("expanded");
      c.querySelector(".spd-expand").innerHTML = "";
    }
  });
  if (isOpen) {
    card.classList.remove("expanded");
    card.querySelector(".spd-expand").innerHTML = "";
    return;
  }
  card.classList.add("expanded");
  renderLtGroupExpansion(card, group);
}

function renderLtGroupExpansion(card, group) {
  const host = card.querySelector(".spd-expand");
  const m = group.members;
  const u = m[0]?.unit || "%";
  const srcMin = _byRole(m,"SOURCEMIN"), srcMax = _byRole(m,"SOURCEMAX"),
        dstMin = _byRole(m,"DESTMIN"),   dstMax = _byRole(m,"DESTMAX");
  host.innerHTML = `
    <div class="lt-edit-section">
      <div class="lt-edit-title">Source Tank</div>
      <div class="lt-edit-row">
        <div class="form-input"><input type="number" step="0.1" min="0" max="100" data-lt-key="sourceMin" value="${srcMin?.current ?? ""}" placeholder="Min level"><span class="u">${u}</span></div>
        <div class="form-input"><input type="number" step="0.1" min="0" max="100" data-lt-key="sourceMax" value="${srcMax?.current ?? ""}" placeholder="Max level"><span class="u">${u}</span></div>
      </div>
    </div>
    <div class="lt-edit-section">
      <div class="lt-edit-title">Destination Tank</div>
      <div class="lt-edit-row">
        <div class="form-input"><input type="number" step="0.1" min="0" max="100" data-lt-key="destMin" value="${dstMin?.current ?? ""}" placeholder="Min level"><span class="u">${u}</span></div>
        <div class="form-input"><input type="number" step="0.1" min="0" max="100" data-lt-key="destMax" value="${dstMax?.current ?? ""}" placeholder="Max level"><span class="u">${u}</span></div>
      </div>
    </div>
    <div class="form-error hidden" data-lt-error></div>
    <div class="spd-expand-actions">
      <button class="dp-btn ghost sm" data-lt-cancel>Cancel</button>
      <button class="dp-btn primary sm" data-lt-apply>Apply set points</button>
    </div>
  `;
  host.querySelector("[data-lt-cancel]").addEventListener("click", e => { e.stopPropagation(); toggleLtGroupCard(card, group); });
  host.querySelector("[data-lt-apply]").addEventListener("click", e => { e.stopPropagation(); applyLtGroup(card, group); });
}

function applyLtGroup(card, group) {
  const vals = {};
  card.querySelectorAll("[data-lt-key]").forEach(i => vals[i.dataset.ltKey] = parseFloat(i.value));
  const err = card.querySelector("[data-lt-error]");
  const problems = [];
  for (const k of ["sourceMin","sourceMax","destMin","destMax"]) {
    if (isNaN(vals[k])) problems.push(`${k} is required`);
    else if (vals[k] < 0 || vals[k] > 100) problems.push(`${k} must be 0–100%`);
  }
  if (!problems.length) {
    if (vals.sourceMin >= vals.sourceMax) problems.push("Source Min must be < Source Max");
    if (vals.destMin   >= vals.destMax)   problems.push("Destination Min must be < Destination Max");
  }
  if (problems.length) {
    err.textContent = problems.join(" · ");
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");

  // Build a virtual "sp" for the processing overlay
  const virtualSp = { name: group.groupName + " (all 4)", unit: group.members[0]?.unit || "%" };
  runProcessing(virtualSp, () => {
    const ROLE_TO_KEY = { SOURCEMIN:"sourceMin", SOURCEMAX:"sourceMax", DESTMIN:"destMin", DESTMAX:"destMax" };
    for (const sp of group.members) {
      const k = ROLE_TO_KEY[sp.subRole];
      const newV = vals[k];
      const from = sp.current;
      if (from !== newV) {
        sp.current = newV;
        sp.history = sp.history || [];
        sp.history.push({ ts: new Date().toISOString(), kind:"value", from, to: newV, who:"op-mihir" });
        sp.source = `Operator override · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
      }
    }
    renderSpDrawer();
  });
}

function deleteLtGroup(group, up) {
  if (!confirm(`Delete "${group.groupName}" (4 set points) from ${up.name}?`)) return;
  const memberIds = group.members.map(m => m.id);
  up.setpointIds = up.setpointIds.filter(id => !memberIds.includes(id));
  window.SETPOINTS = (window.SETPOINTS||[]).filter(s => !memberIds.includes(s.id));
  toast(`Deleted ${group.groupName} (4 set points)`, "ok");
  renderSpDrawer();
}

function toggleSpdCard(card, sp) {
  const isOpen = card.classList.contains("expanded");
  // Close any other expanded card in the drawer
  document.querySelectorAll(".spd-card.expanded").forEach(c => {
    if (c !== card) {
      c.classList.remove("expanded");
      c.querySelector(".spd-expand").innerHTML = "";
    }
  });
  if (isOpen) {
    card.classList.remove("expanded");
    card.querySelector(".spd-expand").innerHTML = "";
    return;
  }
  card.classList.add("expanded");
  renderSpdExpansion(card, sp);
}

function renderSpdExpansion(card, sp) {
  const host = card.querySelector(".spd-expand");
  host.innerHTML = "";
  const editor = buildSliderEditor(sp);
  host.appendChild(editor);
  // Actions row
  const actions = document.createElement("div");
  actions.className = "spd-expand-actions";
  actions.innerHTML = `
    <button class="dp-btn ghost sm" data-spd-cancel>Cancel</button>
    <button class="dp-btn primary sm" data-spd-apply>Apply setpoint</button>
  `;
  host.appendChild(actions);
  actions.querySelector("[data-spd-cancel]").addEventListener("click", e => { e.stopPropagation(); toggleSpdCard(card, sp); });
  actions.querySelector("[data-spd-apply]").addEventListener("click", e => { e.stopPropagation(); applyFromExpansion(card, sp); });
}

function applyFromExpansion(card, sp) {
  const num = card.querySelector("[data-sc-num]");
  const v = parseFloat(num.value);
  if (isNaN(v)) return toast("Enter a valid number", "bad");
  const sliderMin = sp.min == null ? -Infinity : sp.min;
  const sliderMax = sp.max;
  if (v < sliderMin || v > sliderMax) { showWarningPopup(sp, v, false); return; }
  commitSinglePointChange(sp, v);
}

// =====================================================================
// SETPOINT CONTROL POPUP — slider + numeric + live + safe range
// =====================================================================
function openSetpointControlPopup(spId) {
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId);
  if (!sp) return;
  const popup = document.getElementById("setpointControlPopup");
  if (!popup) return;
  popup.dataset.spId = sp.id;
  document.getElementById("scTitle").textContent = sp.name;
  document.getElementById("scSub").textContent  = `${sp.type} · ${sp.equipment}`;
  document.getElementById("scHmi").textContent  = sp.hmiTag || "—";
  document.getElementById("scLive").innerHTML   = `${spLiveText(sp)}`;
  document.getElementById("scRange").innerHTML  = `${spRangeText(sp)}`;

  const body = document.getElementById("scBody");
  body.innerHTML = "";

  if (sp.type === "LT") {
    body.appendChild(buildLtEditor(sp));
  } else {
    body.appendChild(buildSliderEditor(sp));
  }
  popup.classList.remove("hidden");
}
function closeSetpointControlPopup() {
  document.getElementById("setpointControlPopup")?.classList.add("hidden");
}

function buildSliderEditor(sp) {
  const wrap = document.createElement("div");
  const step = stepFor(sp.unit);
  const sliderMin = sp.min == null ? 0 : sp.min;
  const sliderMax = sp.max;
  wrap.innerHTML = `
    <div class="sc-slider-row">
      <span class="sc-tick">${sliderMin} ${sp.unit}</span>
      <input type="range" class="sc-slider" min="${sliderMin}" max="${sliderMax}" step="${step}" value="${sp.current}" />
      <span class="sc-tick">${sliderMax} ${sp.unit}</span>
    </div>
    <div class="sc-num-row">
      <label>New setpoint</label>
      <div class="sc-num">
        <input type="number" step="${step}" value="${sp.current}" data-sc-num>
        <span class="unit">${sp.unit}</span>
      </div>
    </div>
    <div class="sc-marker-row">
      <span>Currently set on PLC: <b>${sp.current} ${sp.unit}</b></span>
    </div>
  `;
  const slider = wrap.querySelector(".sc-slider");
  const num    = wrap.querySelector("[data-sc-num]");
  slider.addEventListener("input", () => { num.value = slider.value; });
  num.addEventListener("input", () => {
    const v = parseFloat(num.value);
    if (!isNaN(v) && v >= sliderMin && v <= sliderMax) slider.value = v;
  });
  return wrap;
}

function buildLtEditor(sp) {
  const wrap = document.createElement("div");
  wrap.className = "sc-lt-grid";
  wrap.innerHTML = `
    <div class="sc-lt-block">
      <div class="sc-lt-title">Intake Tank</div>
      <div class="sc-lt-row"><label>Min</label><div class="sc-num"><input type="number" step="0.1" data-lt="intakeMin" value="${sp.intakeMin}"><span class="unit">${sp.unit}</span></div></div>
      <div class="sc-lt-row"><label>Max</label><div class="sc-num"><input type="number" step="0.1" data-lt="intakeMax" value="${sp.intakeMax}"><span class="unit">${sp.unit}</span></div></div>
    </div>
    <div class="sc-lt-block">
      <div class="sc-lt-title">Outlet Tank</div>
      <div class="sc-lt-row"><label>Min</label><div class="sc-num"><input type="number" step="0.1" data-lt="outletMin" value="${sp.outletMin}"><span class="unit">${sp.unit}</span></div></div>
      <div class="sc-lt-row"><label>Max</label><div class="sc-num"><input type="number" step="0.1" data-lt="outletMax" value="${sp.outletMax}"><span class="unit">${sp.unit}</span></div></div>
    </div>
  `;
  return wrap;
}

// Apply from popup
function applyFromControlPopup() {
  const popup = document.getElementById("setpointControlPopup");
  const spId = popup?.dataset.spId;
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId);
  if (!sp) return;

  if (sp.type === "LT") {
    const vals = {};
    popup.querySelectorAll("[data-lt]").forEach(i => vals[i.dataset.lt] = parseFloat(i.value));
    if (Object.values(vals).some(isNaN)) return toast("All four levels must be numbers", "bad");
    if (vals.intakeMax <= vals.intakeMin) return toast("Intake Max must be greater than Intake Min", "bad");
    if (vals.outletMax <= vals.outletMin) return toast("Outlet Max must be greater than Outlet Min", "bad");
    // LT bounds: each value must be within 0..reasonable (use configured min/max as soft bounds: intakeMin from cfg)
    const outOfRange =
      (vals.intakeMin < (sp.intakeMin*0.5) || vals.intakeMax > (sp.intakeMax*1.5) ||
       vals.outletMin < (sp.outletMin*0.5) || vals.outletMax > (sp.outletMax*1.5));
    if (outOfRange) {
      // warn
      showWarningPopup(sp, vals, /*ltMode*/ true);
      return;
    }
    commitLtChange(sp, vals);
    return;
  }

  const num = popup.querySelector("[data-sc-num]");
  const v = parseFloat(num.value);
  if (isNaN(v)) return toast("Enter a valid number", "bad");

  const sliderMin = sp.min == null ? -Infinity : sp.min;
  const sliderMax = sp.max;
  const outside = v < sliderMin || v > sliderMax;
  if (outside) {
    showWarningPopup(sp, v, /*ltMode*/ false);
    return;
  }
  commitSinglePointChange(sp, v);
}

function commitSinglePointChange(sp, v) {
  runProcessing(sp, () => {
    const from = sp.current;
    sp.current = v;
    sp.source = `Operator override · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
    sp.history = sp.history || [];
    sp.history.push({ ts: new Date().toISOString(), kind:"value", from, to:v, who:"op-mihir" });
    refreshSetpointAllViews(sp.id);
  });
}
function commitLtChange(sp, vals) {
  runProcessing(sp, () => {
    const from = { intakeMin: sp.intakeMin, intakeMax: sp.intakeMax, outletMin: sp.outletMin, outletMax: sp.outletMax };
    Object.assign(sp, vals);
    sp.source = `Operator override · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
    sp.history = sp.history || [];
    sp.history.push({ ts: new Date().toISOString(), kind:"value",
      from: `intake ${from.intakeMin}–${from.intakeMax}${sp.unit}, outlet ${from.outletMin}–${from.outletMax}${sp.unit}`,
      to:   `intake ${vals.intakeMin}–${vals.intakeMax}${sp.unit}, outlet ${vals.outletMin}–${vals.outletMax}${sp.unit}`,
      who: "op-mihir" });
    refreshSetpointAllViews(sp.id);
  });
}

// =====================================================================
// Processing overlay — appears after a set-point change is submitted
// =====================================================================
function runProcessing(sp, onDone) {
  const overlay = document.getElementById("procOverlay");
  if (!overlay) { onDone?.(); return; }
  const title = document.getElementById("procTitle");
  const sub = document.getElementById("procSub");
  const steps = overlay.querySelectorAll(".ps");
  title.textContent = `Updating ${sp.name}`;
  sub.textContent = "Writing the new value to the PLC…";
  steps.forEach(s => s.classList.remove("active","done"));
  overlay.classList.remove("hidden");
  setTimeout(() => steps[0].classList.add("active"), 50);
  setTimeout(() => { steps[0].classList.add("done"); steps[1].classList.add("active"); }, 900);
  setTimeout(() => { steps[1].classList.add("done"); steps[2].classList.add("active"); }, 1900);
  setTimeout(() => {
    steps[2].classList.add("done");
    title.textContent = "Set point applied";
    sub.textContent = "PLC confirmed the new value. Fallback logic unaffected.";
  }, 2700);
  setTimeout(() => {
    overlay.classList.add("hidden");
    toast(`Saved: ${sp.name}`, "ok");
    onDone?.();
  }, 3300);
}

// =====================================================================
// Notification preferences popover
// =====================================================================
let notifyTargetSpId = null;
function openNotifyPopover(sp) {
  notifyTargetSpId = sp.id;
  const modal = document.getElementById("notifyPopover");
  document.getElementById("notifyTitle").textContent = `Notify on change · ${sp.name}`;
  const usersHost = document.getElementById("notifyUsers");
  const chansHost = document.getElementById("notifyChannels");
  usersHost.innerHTML = ""; chansHost.innerHTML = "";
  const prefs = sp.notify || { users: [], channels: [] };
  for (const u of (window.NOTIFY_USERS||[])) {
    const checked = prefs.users.includes(u.id);
    usersHost.insertAdjacentHTML("beforeend", `
      <label class="notify-row"><input type="checkbox" data-user="${u.id}" ${checked?"checked":""}>
        <span><b>${u.name}</b><small>${u.role}</small></span></label>`);
  }
  for (const ch of (window.NOTIFY_CHANNELS||[])) {
    const checked = prefs.channels.includes(ch);
    chansHost.insertAdjacentHTML("beforeend", `
      <label class="notify-chip"><input type="checkbox" data-channel="${ch}" ${checked?"checked":""}><span>${ch}</span></label>`);
  }
  modal.classList.remove("hidden");
}
function closeNotifyPopover() { document.getElementById("notifyPopover")?.classList.add("hidden"); notifyTargetSpId = null; }
function saveNotifyPopover() {
  if (!notifyTargetSpId) return;
  const sp = (window.SETPOINTS||[]).find(x => x.id === notifyTargetSpId); if (!sp) return;
  const users = Array.from(document.querySelectorAll("#notifyUsers input:checked")).map(i => i.dataset.user);
  const channels = Array.from(document.querySelectorAll("#notifyChannels input:checked")).map(i => i.dataset.channel);
  sp.notify = { users, channels };
  toast(`Notification preferences saved · ${users.length} user${users.length===1?"":"s"} · ${channels.length} channel${channels.length===1?"":"s"}`, "ok");
  closeNotifyPopover();
}

// =====================================================================
// Add equipment to a unit process
// =====================================================================
function openAddEquipmentPopover(card, up) {
  // Inline picker — append a small popover inside the card
  const existing = card.querySelector(".up-eq-picker");
  if (existing) { existing.remove(); return; }
  const popover = document.createElement("div");
  popover.className = "up-eq-picker";
  const available = Object.keys(DEVICES).filter(id => !up.equipmentIds.includes(id));
  popover.innerHTML = `
    <div class="up-eq-picker-head">Add equipment to ${up.name}</div>
    <div class="up-eq-picker-list">
      ${available.length ? available.map(id => `<button class="up-eq-pick" data-id="${id}">${DEVICES[id].name}</button>`).join("") : '<div class="up-empty" style="margin:8px 0">All equipment already added.</div>'}
    </div>
  `;
  card.querySelector(".up-equip").after(popover);
  popover.querySelectorAll(".up-eq-pick").forEach(b => b.addEventListener("click", () => {
    up.equipmentIds.push(b.dataset.id);
    populateUpExpansion(card, up);
    card.querySelector(".up-sub").innerHTML = `<b>${up.equipmentIds.length}</b> equipment · <b>${up.setpointIds.length}</b> set point${up.setpointIds.length===1?"":"s"}`;
  }));
}

// =====================================================================
// Add set point to a unit process — inline form with type-specific fields
// =====================================================================
function openAddSetpointForm(card, up) {
  const existing = card.querySelector(".up-add-sp-form");
  if (existing) { existing.remove(); return; }
  const form = document.createElement("div");
  form.className = "up-add-sp-form";
  form.innerHTML = `
    <div class="up-add-sp-head">Add set point to ${up.name}</div>
    <div class="form-row">
      <select data-f="type">
        <option value="DO">DO (Dissolved Oxygen)</option>
        <option value="PT">PT (Pressure Transmitter)</option>
        <option value="LT">LT (Transfer Pump · 4 sub-set-points)</option>
        <option value="Flow">Flow</option>
        <option value="Switchover Time">Switchover Time</option>
      </select>
    </div>
    <div class="form-row">
      <input type="text" data-f="name" placeholder="Set point name (e.g., DO target — Zone-3)" />
    </div>
    <div class="hmi-readonly" data-f="hmi-block">
      <div class="hmi-readonly-label">HMI tag <span class="muted">· auto-generated</span></div>
      <code data-f="hmi-preview">—</code>
    </div>
    <div class="form-schema" data-schema></div>
    <div class="form-row form-error hidden" data-error></div>
    <div class="form-actions">
      <button class="dp-btn ghost sm" data-cancel>Cancel</button>
      <button class="dp-btn primary sm" data-save>Save</button>
    </div>
  `;
  card.querySelector("[data-sp-list]").appendChild(form);

  // LT sub-roles in the order they're saved
  const LT_ROLES = [
    { key:"sourceMin", label:"Source Tank · Min Level", role:"SOURCEMIN" },
    { key:"sourceMax", label:"Source Tank · Max Level", role:"SOURCEMAX" },
    { key:"destMin",   label:"Destination Tank · Min Level", role:"DESTMIN" },
    { key:"destMax",   label:"Destination Tank · Max Level", role:"DESTMAX" },
  ];

  const updateHmi = () => {
    const t = form.querySelector("[data-f=type]").value;
    const baseIdx = (up.setpointIds.length || 0) + 1;
    const preview = form.querySelector("[data-f=hmi-preview]");
    if (t === "LT") {
      // Show 4 tags
      preview.innerHTML = LT_ROLES.map((r, i) => `<div class="hmi-tag-line">${window.generateHmiTag(up.name, "LT", baseIdx + i, r.role)} <span class="muted">· ${r.label}</span></div>`).join("");
    } else {
      preview.innerHTML = window.generateHmiTag(up.name, t, baseIdx);
    }
  };
  const renderSchema = () => {
    const t = form.querySelector("[data-f=type]").value;
    const host = form.querySelector("[data-schema]");
    const unit = (window.SP_TYPE_UNIT||{})[t] || "";
    if (t === "LT") {
      host.innerHTML = `
        <div class="form-section-label">Source &amp; Destination tank levels <span class="muted">· 0–100${unit}</span></div>
        <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="sourceMin" min="0" max="100" placeholder="Source tank · min level"><span class="u">${unit}</span></div></div>
        <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="sourceMax" min="0" max="100" placeholder="Source tank · max level"><span class="u">${unit}</span></div></div>
        <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="destMin"   min="0" max="100" placeholder="Destination tank · min level"><span class="u">${unit}</span></div></div>
        <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="destMax"   min="0" max="100" placeholder="Destination tank · max level"><span class="u">${unit}</span></div></div>
      `;
    } else if (t === "PT") {
      host.innerHTML = `
        <div class="form-section-label">Pressure thresholds</div>
        <div class="form-grid-2">
          <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="max" placeholder="Maximum (required)"><span class="u">${unit}</span></div></div>
          <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="min" placeholder="Minimum (optional)"><span class="u">${unit}</span></div></div>
        </div>
      `;
    } else if (t === "Switchover Time") {
      host.innerHTML = `
        <div class="form-section-label">Switchover duration</div>
        <div class="form-grid-2">
          <div class="form-row"><div class="form-input"><input type="number" step="1" data-f="current" placeholder="Current value"><span class="u">${unit}</span></div></div>
          <div class="form-row"><div class="form-input"><input type="number" step="1" data-f="max"     placeholder="Maximum allowed"><span class="u">${unit}</span></div></div>
        </div>
      `;
    } else {
      host.innerHTML = `
        <div class="form-section-label">Allowed range</div>
        <div class="form-grid-2">
          <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="min" placeholder="Minimum"><span class="u">${unit}</span></div></div>
          <div class="form-row"><div class="form-input"><input type="number" step="any" data-f="max" placeholder="Maximum"><span class="u">${unit}</span></div></div>
        </div>
      `;
    }
    // Live min>max validation
    host.querySelectorAll('input[data-f="min"],input[data-f="max"],input[data-f="sourceMin"],input[data-f="sourceMax"],input[data-f="destMin"],input[data-f="destMax"]').forEach(i => {
      i.addEventListener("input", () => validateForm(form, t));
    });
  };

  form.querySelector("[data-f=type]").addEventListener("change", () => { updateHmi(); renderSchema(); });
  form.querySelector("[data-f=name]").addEventListener("input", updateHmi);
  form.querySelector("[data-cancel]").addEventListener("click", () => form.remove());
  form.querySelector("[data-save]").addEventListener("click", () => saveNewSetpoint(form, up, card));
  updateHmi();
  renderSchema();
}

function validateForm(form, type) {
  const errBox = form.querySelector("[data-error]");
  errBox.classList.add("hidden"); errBox.textContent = "";
  form.querySelectorAll(".form-input").forEach(el => el.classList.remove("invalid"));
  let problems = [];

  const num = sel => parseFloat(form.querySelector(`[data-f="${sel}"]`)?.value);

  if (type === "LT") {
    const sMin = num("sourceMin"), sMax = num("sourceMax"), dMin = num("destMin"), dMax = num("destMax");
    if (!isNaN(sMin) && (sMin < 0 || sMin > 100)) { markInvalid(form,"sourceMin"); problems.push("Source Tank Min must be 0–100%"); }
    if (!isNaN(sMax) && (sMax < 0 || sMax > 100)) { markInvalid(form,"sourceMax"); problems.push("Source Tank Max must be 0–100%"); }
    if (!isNaN(dMin) && (dMin < 0 || dMin > 100)) { markInvalid(form,"destMin");   problems.push("Destination Tank Min must be 0–100%"); }
    if (!isNaN(dMax) && (dMax < 0 || dMax > 100)) { markInvalid(form,"destMax");   problems.push("Destination Tank Max must be 0–100%"); }
    if (!isNaN(sMin) && !isNaN(sMax) && sMin >= sMax) { markInvalid(form,"sourceMin"); markInvalid(form,"sourceMax"); problems.push("Source Min must be less than Source Max"); }
    if (!isNaN(dMin) && !isNaN(dMax) && dMin >= dMax) { markInvalid(form,"destMin");   markInvalid(form,"destMax");   problems.push("Destination Min must be less than Destination Max"); }
  } else {
    const mi = num("min"), mx = num("max");
    if (!isNaN(mi) && !isNaN(mx) && mi >= mx) { markInvalid(form,"min"); markInvalid(form,"max"); problems.push("Min must be less than Max"); }
  }

  if (problems.length) {
    errBox.textContent = problems.join(" · ");
    errBox.classList.remove("hidden");
    return false;
  }
  return true;
}
function markInvalid(form, key) {
  form.querySelector(`[data-f="${key}"]`)?.closest(".form-input")?.classList.add("invalid");
}

function saveNewSetpoint(form, up, card) {
  const type = form.querySelector("[data-f=type]").value;
  const name = form.querySelector("[data-f=name]").value.trim();
  if (!name) return toast("Name is required", "bad");
  if (!validateForm(form, type)) return toast("Fix the highlighted errors", "bad");
  const unit = (window.SP_TYPE_UNIT||{})[type] || "";
  const num = sel => parseFloat(form.querySelector(`[data-f="${sel}"]`)?.value);

  if (type === "LT") {
    const ROLES = [
      { key:"sourceMin", label:"Source Tank · Min Level", role:"SOURCEMIN" },
      { key:"sourceMax", label:"Source Tank · Max Level", role:"SOURCEMAX" },
      { key:"destMin",   label:"Destination Tank · Min Level", role:"DESTMIN" },
      { key:"destMax",   label:"Destination Tank · Max Level", role:"DESTMAX" },
    ];
    const vals = {};
    for (const r of ROLES) {
      const v = num(r.key);
      if (isNaN(v)) return toast(`All four LT levels are required`, "bad");
      vals[r.key] = v;
    }
    const groupId = "lt-" + Date.now().toString(36);
    let idx = (up.setpointIds.length||0) + 1;
    for (const r of ROLES) {
      const id = groupId + "-" + r.role.toLowerCase();
      const sp = {
        id, type: "LT", subRole: r.role,
        groupId, groupName: name,
        name: `${name} · ${r.label}`,
        hmiTag: window.generateHmiTag(up.name, "LT", idx, r.role),
        unit: "%", current: vals[r.key], min: 0, max: 100,
        active: true, equipment: up.name, targets: [...up.equipmentIds],
        source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
        history: [],
      };
      (window.SETPOINTS||[]).push(sp);
      up.setpointIds.push(id);
      idx++;
    }
    toast(`Added 1 LT set point group (4 HMI tags)`, "ok");
  } else {
    const id = "sp-" + Date.now().toString(36);
    const hmiTag = window.generateHmiTag(up.name, type, (up.setpointIds.length||0)+1);
    const sp = { id, type, name, hmiTag, unit, active:true, equipment: up.name, targets: [...up.equipmentIds], source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}), history: [] };
    if (type === "PT") {
      const mx = num("max"), miRaw = form.querySelector("[data-f=min]").value;
      if (isNaN(mx)) return toast("Max is required", "bad");
      const mi = miRaw === "" ? null : parseFloat(miRaw);
      Object.assign(sp, { min:mi, max:mx, current: mx*0.6 });
    } else if (type === "Switchover Time") {
      const cur = num("current"), mx = num("max");
      if (isNaN(cur) || isNaN(mx)) return toast("Both fields required", "bad");
      Object.assign(sp, { min:1, max:mx, current:cur });
    } else {
      const mi = num("min"), mx = num("max");
      if (isNaN(mi) || isNaN(mx)) return toast("Min and Max required", "bad");
      Object.assign(sp, { min:mi, max:mx, current: (mi+mx)/2 });
    }
    (window.SETPOINTS||[]).push(sp);
    up.setpointIds.push(id);
    toast(`Added: ${name}`, "ok");
  }
  form.remove();
  populateUpExpansion(card, up);
  card.querySelector(".up-sub").innerHTML = `<b>${up.equipmentIds.length}</b> equipment · <b>${up.setpointIds.length}</b> set point${up.setpointIds.length===1?"":"s"}`;
}

// =====================================================================
// Config mode toggle
// =====================================================================
function toggleConfigMode() {
  configMode = !configMode;
  document.body.classList.toggle("config-mode", configMode);
  document.getElementById("configBanner")?.classList.toggle("hidden", !configMode);
  const btn = document.getElementById("configToggle");
  if (btn) {
    btn.setAttribute("aria-pressed", configMode ? "true" : "false");
    btn.querySelector(".mode-label").textContent = configMode ? "Configuration mode" : "Client view";
  }
  // Re-render drawer with config affordances
  renderSpDrawer();
}

// Warning popup — value outside safe range
let pendingWarn = null;
function showWarningPopup(sp, payload, ltMode) {
  pendingWarn = { sp, payload, ltMode };
  const modal = document.getElementById("scWarn");
  const body  = document.getElementById("scWarnBody");
  if (ltMode) {
    body.innerHTML = `One or more values are <b>outside the configured safe range</b> for this transfer pump.<br><br>Override only if you understand the operational consequence.`;
  } else {
    const lo = sp.min == null ? "—" : sp.min;
    body.innerHTML = `Your value <b>${payload} ${sp.unit}</b> is <b>outside the configured safe range</b> (${lo} – ${sp.max} ${sp.unit}) for <b>${sp.name}</b>.<br><br>The system only warns — you may override and proceed.`;
  }
  modal.classList.remove("hidden");
}
function cancelWarn() {
  document.getElementById("scWarn")?.classList.add("hidden");
  pendingWarn = null;
}
function overrideWarn() {
  if (!pendingWarn) return;
  const { sp, payload, ltMode } = pendingWarn;
  document.getElementById("scWarn")?.classList.add("hidden");
  pendingWarn = null;
  if (ltMode) commitLtChange(sp, payload);
  else commitSinglePointChange(sp, payload);
}

// =====================================================================
// Set Point Control Panel (dedicated editor, no plant layout)
// =====================================================================
let spcFilter = "all";  // 'all' or one of the SP type strings
let spcSearch = "";

function renderSpControlPanel() {
  const all = window.SETPOINTS || [];
  // Build category sidebar (counts by type, plus "All")
  const sideList = $("#spcSideList");
  if (sideList) {
    sideList.innerHTML = "";
    const typeOrder = ["Level","DO","Differential Pressure","Differential Pressure (calculated)","pH","FRC","ORP","Flow","Time"];
    const types = ["All", ...typeOrder.filter(t => all.some(sp => sp.type === t))];
    for (const t of types) {
      const cat = document.createElement("div");
      const id = t === "All" ? "all" : t;
      cat.className = "spc-cat" + (id === spcFilter ? " active" : "");
      cat.dataset.cat = id;
      const count = t === "All" ? all.length : all.filter(sp => sp.type === t).length;
      const ic = t === "All" ? "ALL" : t.slice(0,3).toUpperCase();
      cat.innerHTML = `
        <div class="cat-ic">${ic}</div>
        <div class="cat-name">${t}</div>
        <div class="cat-count">${count}</div>
      `;
      cat.addEventListener("click", () => { spcFilter = id; renderSpControlPanel(); });
      sideList.appendChild(cat);
    }
  }

  // Compute filtered list
  const sps = all.filter(sp => {
    if (spcFilter !== "all" && sp.type !== spcFilter) return false;
    if (spcSearch) {
      const hay = (sp.name + " " + sp.equipment + " " + sp.type + " " + (sp.hmiTag||"")).toLowerCase();
      if (!hay.includes(spcSearch)) return false;
    }
    return true;
  });

  $("#spcCatTitle").textContent = spcFilter === "all" ? "All set points" : spcFilter;
  $("#spcCatSub").textContent   = `${sps.length} set point${sps.length===1?'':'s'}` + (spcFilter !== "all" ? "" : " configured");

  const grid = $("#spcGrid");
  grid.innerHTML = "";
  if (!sps.length) {
    const empty = document.createElement("div");
    empty.className = "spc-empty";
    empty.textContent = "No set points match this filter.";
    grid.appendChild(empty);
    return;
  }
  for (const sp of sps) grid.appendChild(renderSpcCard(sp));
}

function renderSpcCard(sp) {
  const card = document.createElement("div");
  card.className = "spc-card" + (sp.active ? "" : " disabled");
  card.dataset.spId = sp.id;
  const typeShort = sp.type.replace(/\s.+/, "").slice(0,4).toUpperCase();
  const eqNames = (sp.targets||[]).map(t => DEVICES[t]?.name || t);
  card.innerHTML = `
    <div class="spc-card-head">
      <div class="spc-card-tile">${typeShort}</div>
      <div class="spc-card-meta">
        <div class="spc-card-name">${sp.name}</div>
        <div class="spc-card-eq">${sp.equipment}</div>
      </div>
      <span class="spc-card-status ${sp.active?'on':'off'}">
        <span class="pulse"></span>${sp.active?'ENABLED':'DISABLED'}
      </span>
    </div>

    <div class="spc-hmi-row">
      <span class="label">HMI</span>
      <code>${sp.hmiTag||"—"}</code>
    </div>

    <div class="spc-value-display" data-mode="view">
      <div>
        <span class="spc-value-num">${sp.current}</span>
        <span class="spc-value-unit">${sp.unit}</span>
      </div>
      <button class="spc-value-edit" data-spc-edit>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        Edit
      </button>
    </div>

    <div class="spc-card-foot">
      <div class="spc-foot-cell">
        <div class="k">Range</div>
        <div class="v">${sp.min} – ${sp.max} <span style="color:var(--muted)">${sp.unit}</span></div>
      </div>
      <div class="spc-foot-cell">
        <div class="k">Equipment</div>
        <div class="v" title="${eqNames.join(', ')}">${eqNames.length ? eqNames.slice(0,2).join(", ") + (eqNames.length>2?` +${eqNames.length-2}`:"") : "—"}</div>
      </div>
      <div class="spc-foot-cell" style="grid-column:1/-1">
        <div class="k">Source</div>
        <div class="v">${sp.source}</div>
      </div>
    </div>
  `;

  const editBtn = card.querySelector("[data-spc-edit]");
  const display = card.querySelector(".spc-value-display");
  editBtn?.addEventListener("click", () => enterSpcEditMode(card, sp));
  return card;
}

function enterSpcEditMode(card, sp) {
  const display = card.querySelector(".spc-value-display");
  display.dataset.mode = "edit";
  display.classList.add("editing");
  display.innerHTML = `
    <div class="spc-value-input-wrap">
      <input type="number" step="${sp.unit==='pH'?'0.1':sp.unit==='bar'?'0.1':sp.unit==='ppm'?'0.1':'1'}" value="${sp.current}" />
      <span class="spc-value-unit-inline">${sp.unit}</span>
    </div>
    <div class="spc-edit-actions">
      <button class="btn-mini cancel" data-cancel>Cancel</button>
      <button class="btn-mini save" data-save>Save</button>
    </div>
  `;
  const inp = display.querySelector("input");
  inp.focus(); inp.select();
  display.querySelector("[data-cancel]").addEventListener("click", () => {
    // Re-render this single card
    const fresh = renderSpcCard(sp);
    card.replaceWith(fresh);
  });
  display.querySelector("[data-save]").addEventListener("click", () => {
    promptApplySetpoint(sp.id, parseFloat(inp.value));
  });
}

// =====================================================================
// Loader
// =====================================================================
function runRemoteLoader(onDone) {
  const overlay = document.getElementById("remoteLoader");
  const card = overlay?.querySelector(".rl-card");
  const fill = document.getElementById("rlBarFill");
  const log = document.getElementById("rlLog");
  const foot = document.getElementById("rlFootStatus");
  if (!overlay) { onDone?.(); return; }
  overlay.classList.remove("hidden");
  card.classList.remove("done");
  fill.style.transition = "none"; fill.style.right = "100%";
  log.innerHTML = "";
  foot.textContent = "handshake in progress…";
  requestAnimationFrame(() => { fill.style.transition = "right 3s linear"; fill.style.right = "0%"; });
  const startTs = Date.now();
  const ts = () => `[${((Date.now()-startTs)/1000).toFixed(3).padStart(7,"0")}s]`;
  const append = (lvl, html) => { const ln=document.createElement("div"); ln.className=`ln ${lvl}`; ln.innerHTML=`<span class="ts">${ts()}</span><span class="lvl">${lvl.toUpperCase()}</span><span class="msg">${html}</span>`; log.appendChild(ln); };
  const lines = [
    [50,"info",`OPEN tcp://10.42.7.18:4840 <span class="k">opcua</span>`],
    [320,"info",`TLS handshake · cipher=<span class="k">TLS_AES_256_GCM_SHA384</span>`],
    [620,"ok",`PLC handshake complete · session=<span class="k">0x9F3A</span>`],
    [900,"info",`AUTH user=<span class="k">op-mihir</span> · role=<span class="k">section_supervisor</span>`],
    [1180,"ok",`Authentication OK`],
    [1460,"info",`Interlock matrix snapshot · <span class="k">17 nodes / 6 rules</span>`],
    [2050,"ok",`Interlocks validated`],
    [2620,"ok",`Channel ENGAGED · heartbeat 250ms`],
    [2900,"ok",`READY · operator now in control`],
  ];
  const timers = lines.map(([t,lvl,msg]) => setTimeout(() => append(lvl,msg), t));
  setTimeout(() => { overlay.classList.add("hidden"); card.classList.add("done"); foot.textContent="channel ready"; timers.forEach(clearTimeout); onDone?.(); }, 3050);
}

// =====================================================================
// Toast
// =====================================================================
let toastT;
function toast(msg, kind="") {
  const t = $("#toast"); t.className = "toast " + kind; t.textContent = msg;
  t.classList.remove("hidden"); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}

// =====================================================================
// Init
// =====================================================================
function tickClock(){
  const now = new Date();
  $("#hdrDate").textContent = now.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}).replace(/-/g," ");
  $("#hdrTime").textContent = now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:true}).toUpperCase();
}

document.addEventListener("DOMContentLoaded", () => {
  tickClock(); setInterval(tickClock, 30000);

  // Page selector
  $("#pageSelect")?.addEventListener("change", e => switchPage(e.target.value));

  // Group panel + Set Points drawer
  $("#openGroupControl")?.addEventListener("click", openGroupPanel);
  $("#closeGroupPanel")?.addEventListener("click", closeGroupPanel);
  $("#refreshStatus")?.addEventListener("click", () => toast("Status refreshed", "ok"));
  $("#openSetPoints")?.addEventListener("click", openSetPointsDrawer);
  $("#closeSetPoints")?.addEventListener("click", closeSetPointsDrawer);
  $("#spDrawerSearch")?.addEventListener("input", e => { spDrawerFilters.search = e.target.value.toLowerCase(); renderSpDrawer(); });
  $("#configToggle")?.addEventListener("click", toggleConfigMode);
  $("#notifyClose")?.addEventListener("click", closeNotifyPopover);
  $("#notifyCancel")?.addEventListener("click", closeNotifyPopover);
  $("#notifySave")?.addEventListener("click", saveNotifyPopover);

  // Set point notice modal (legacy)
  $("#spNoticeCancel")?.addEventListener("click", () => { document.getElementById("spNotice").classList.add("hidden"); pendingSp = null; });
  $("#spNoticeConfirm")?.addEventListener("click", applyPendingSp);

  // Warning override modal (shared)
  $("#scWarnCancel")?.addEventListener("click", cancelWarn);
  $("#scWarnOverride")?.addEventListener("click", overrideWarn);

  // Simple Set Point Configuration
  $("#cfgAddBtn")?.addEventListener("click", () => openCfgModal(null));
  $("#cfgModalClose")?.addEventListener("click", closeCfgModal);
  $("#cfgModalCancel")?.addEventListener("click", closeCfgModal);
  $("#cfgModalSave")?.addEventListener("click", saveCfgModal);
  $("#cfgSearch2")?.addEventListener("input", renderCfgTable);
  $("#cfgFilterType")?.addEventListener("change", renderCfgTable);
  $("#cfgFType")?.addEventListener("change", e => { renderCfgSchema(e.target.value, null); updateCfgHmi(); });
  $("#cfgFUp")?.addEventListener("change", updateCfgHmi);

  // Studio
  $("#studioUpName")?.addEventListener("input", e => {
    const up = studioSelectedUp(); if (!up) return;
    up.name = e.target.value;
    renderStudioUpList();
  });
  $("#studioAddUp")?.addEventListener("click", studioAddUp);
  $("#studioDeleteUp")?.addEventListener("click", studioDeleteUp);
  $("#studioEditEquip")?.addEventListener("click", openEquipPicker);
  $("#studioPublish")?.addEventListener("click", studioPublish);
  $("#studioPreview")?.addEventListener("click", () => {
    document.getElementById("pageSelect").value = "dashboard";
    switchPage("dashboard");
  });
  $("#equipPickerClose")?.addEventListener("click", () => document.getElementById("equipPickerModal").classList.add("hidden"));
  $("#equipPickerSave")?.addEventListener("click", saveEquipPicker);

  // Version nudge
  $("#versionReload")?.addEventListener("click", () => {
    document.getElementById("versionNudge").classList.add("hidden");
    if (document.getElementById("view-dashboard").classList.contains("hidden") === false) renderDashboard();
    if (document.getElementById("setPointsPanel").classList.contains("hidden") === false) renderSpDrawer();
    toast(`Loaded layout v${window.LAYOUT_VERSION.version}`, "ok");
  });

  // Set Points filters
  $("#spSearch")?.addEventListener("input", renderSetpointsPage);
  $("#spTypeFilter")?.addEventListener("change", renderSetpointsPage);

  // Control Panel sidebar search
  $("#spcSearch")?.addEventListener("input", e => { spcSearch = e.target.value.toLowerCase(); renderSpControlPanel(); });

  // Zoom controls
  $("#zoomIn")?.addEventListener("click", () => zoomBy(1/1.25));
  $("#zoomOut")?.addEventListener("click", () => zoomBy(1.25));
  $("#zoomFit")?.addEventListener("click", () => { if (viewState.defaultBox) setViewBox(viewState.defaultBox, true); });

  // Initial render
  renderScada();
});
