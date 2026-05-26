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
  if (block) { toast(block, "bad"); refreshEquipmentRow(id); return; }
  d.on = nextOn;
  toast(`${d.name} → ${nextOn?"ON":"OFF"}`, "ok");
  updateDeviceCells(id);
  refreshEquipmentRow(id);
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
  renderEquipmentList();
  toast("Group Control opened · select equipment to control", "ok");
}
function closeGroupPanel() {
  document.getElementById("groupPanel").classList.add("hidden");
  document.getElementById("dpMain").classList.remove("side-open");
  // also close equipment drawer if open
  closeEqDrawer();
}
function renderEquipmentList() {
  const list = document.getElementById("equipList");
  if (!list) return;
  list.innerHTML = "";
  const ids = Object.keys(DEVICES);
  document.getElementById("equipCountPill").textContent = `${ids.length} equipments`;
  document.getElementById("groupCount").textContent = ids.length;
  for (const id of ids) {
    const d = DEVICES[id];
    const row = document.createElement("div");
    row.className = "dp-equip-row" + (d.on?" on-now":"");
    row.dataset.id = id;
    row.innerHTML = `
      <div class="eq-icon-tile">${iconFor(d.type)}</div>
      <div class="eq-meta">
        <div class="name">${d.name}</div>
        <span class="type-pill">${d.type.toUpperCase()}</span>
        <div class="status-line">STATUS: <b class="${d.on?'on':'off'}">${d.on?'On':'Off'}</b></div>
      </div>
      <button class="eq-control-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        Control
      </button>`;
    // Open the equipment drawer (child-level set points + on/off) on click
    row.addEventListener("click", () => openEqDrawer(id));
    row.querySelector(".eq-control-btn").addEventListener("click", e => { e.stopPropagation(); openEqDrawer(id); });
    // Hover preview on the layout
    row.addEventListener("mouseenter", () => highlightDevice(id, true));
    row.addEventListener("mouseleave", () => highlightDevice(id, false));
    list.appendChild(row);
  }
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
// Equipment Drawer (Child-level: set point edits)
// =====================================================================
function openEqDrawer(id) {
  const d = DEVICES[id]; if (!d) return;
  const drawer = document.getElementById("eqDrawer");
  drawer.classList.remove("hidden");
  drawer.dataset.id = id;
  document.getElementById("dpMain").classList.add("drawer-open");
  document.getElementById("eqTitle").textContent = d.name;
  document.getElementById("eqMeta").innerHTML = `${d.type.toUpperCase()} · status <b>${d.on?'On':'Off'}</b> · mode <b>${d.mode.toUpperCase()}</b>`;
  renderEqDrawerBody(id);
  // pop highlight on the layout
  highlightDevice(id, true);
  setTimeout(() => highlightDevice(id, false), 1200);
}
function closeEqDrawer() {
  document.getElementById("eqDrawer").classList.add("hidden");
  document.getElementById("dpMain").classList.remove("drawer-open");
}
function renderEqDrawerBody(id) {
  const d = DEVICES[id];
  const body = document.getElementById("eqBody");
  body.innerHTML = "";

  // 1) Status & On/Off controls
  const statusCard = document.createElement("div");
  statusCard.className = "eq-status-card";
  statusCard.innerHTML = `
    <div class="eq-status-row">
      <div>
        <div class="dp-card-title" style="margin-bottom:4px">Live control</div>
        <div class="dp-card-sub">Toggle ON/OFF · mode change requires Remote</div>
      </div>
      <span class="eq-mode-pill ${d.mode==='remote'?'remote':'local'}">${d.mode==='remote'?'REMOTE':'LOCAL (PLC)'}</span>
    </div>
    <div class="eq-onoff-bar">
      <button class="seg ${d.on?'active on':''}" data-act="on">▶ ON</button>
      <button class="seg ${!d.on?'active off':''}" data-act="off">■ OFF</button>
    </div>
  `;
  body.appendChild(statusCard);
  statusCard.querySelector('[data-act="on"]').addEventListener("click", () => { attemptToggle(id, true); openEqDrawer(id); });
  statusCard.querySelector('[data-act="off"]').addEventListener("click", () => { attemptToggle(id, false); openEqDrawer(id); });

  // 2) Set points linked to this equipment
  const linkedSps = (window.SETPOINTS||[]).filter(sp => sp.targets?.includes(id) || sp.targets?.some(t => t===id));
  if (linkedSps.length) {
    const h = document.createElement("div");
    h.style.cssText = "font-size:10.5px;letter-spacing:1.4px;color:var(--muted);font-weight:700;margin:6px 0 -2px";
    h.textContent = "SET POINTS LINKED TO THIS EQUIPMENT";
    body.appendChild(h);
    for (const sp of linkedSps) body.appendChild(renderSetpointCard(sp, /*compact*/ true));
  } else {
    const noSp = document.createElement("div");
    noSp.style.cssText = "padding:12px;background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;font-size:12px;color:var(--muted);text-align:center";
    noSp.textContent = "No set-points linked to this equipment.";
    body.appendChild(noSp);
  }
}

// =====================================================================
// Set Point card renderer (used in drawer + All Set Points page)
// =====================================================================
function renderSetpointCard(sp, compact=false) {
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
          <div class="sp-card-sub">${sp.equipment} · ${sp.type}</div>
        </div>
      </div>
      <div>
        <label class="sp-toggle"><input type="checkbox" ${sp.active?"checked":""} data-sp-active><span class="slider"></span></label>
      </div>
    </div>
    <div class="sp-card-body">
      <div class="sp-row">
        <div class="lbl">Current set point<small>${sp.description||""}</small></div>
        <div class="sp-input">
          <input type="number" step="${sp.unit==='pH'?'0.1':sp.unit==='bar'?'0.1':sp.unit==='ppm'?'0.1':'1'}" value="${sp.current}" data-sp-value>
          <span class="unit">${sp.unit}</span>
          <button class="save" data-sp-save>Save</button>
        </div>
      </div>
      <div>
        <div class="sp-range-bar">
          ${rangeBarHtml(sp)}
        </div>
        <div class="sp-range-ticks">
          <span>min ${sp.min}${sp.unit}</span>
          <span>safe ${sp.safeMin}–${sp.safeMax}${sp.unit}</span>
          <span>max ${sp.max}${sp.unit}</span>
        </div>
      </div>
      ${sp.vfd ? `
        <div class="sp-row">
          <div class="lbl">Linked VFD output<small>Computed by PLC — read-only here</small></div>
          <div style="display:flex;gap:8px;font-size:12px;font-family:monospace">
            <span>${sp.vfd.rpm} rpm</span><span>·</span>
            <span>${sp.vfd.freq} Hz</span><span>·</span>
            <span>${sp.vfd.current} A</span>
          </div>
        </div>` : ""}
      <div style="font-size:11px;color:var(--muted);padding-top:4px;border-top:1px solid var(--line)">
        <b style="color:var(--text-2)">Source:</b> ${sp.source} ·
        <b style="color:var(--text-2)">Behaviour:</b> ${sp.behaviour}
      </div>
    </div>
  `;
  // Wire actions
  const valInput = card.querySelector("[data-sp-value]");
  const saveBtn  = card.querySelector("[data-sp-save]");
  const activeIn = card.querySelector("[data-sp-active]");
  saveBtn.addEventListener("click", () => promptApplySetpoint(sp.id, parseFloat(valInput.value)));
  activeIn.addEventListener("change", e => { sp.active = e.target.checked; toast(`${sp.name} ${sp.active?"activated":"paused"}`, "ok"); refreshSetpointAllViews(sp.id); });
  return card;
}
function rangeBarHtml(sp) {
  const span = sp.max - sp.min || 1;
  const safeL = ((sp.safeMin - sp.min) / span) * 100;
  const safeW = ((sp.safeMax - sp.safeMin) / span) * 100;
  const cur = ((sp.current - sp.min) / span) * 100;
  return `
    <div class="min-max" style="left:0;width:100%"></div>
    <div class="safe" style="left:${safeL}%;width:${safeW}%"></div>
    <div class="marker" style="left:calc(${cur}% - 1.5px)"></div>
  `;
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
  pendingSp = { spId, newValue };
  const outOfSafe = newValue < sp.safeMin || newValue > sp.safeMax;
  // populate notice
  document.getElementById("spNoticeBody").innerHTML = `
    Updating <b>${sp.name}</b> from <b>${sp.current} ${sp.unit}</b> → <b>${newValue} ${sp.unit}</b>.
    Logic is unchanged — the PLC will use the new threshold from the next evaluation tick.
    ${outOfSafe ? `<br><br><span style="color:#aa1c1c;font-weight:600">⚠ Value is OUTSIDE the safe range (${sp.safeMin}–${sp.safeMax} ${sp.unit}). Behaviour may be unexpected.</span>` : ""}
  `;
  const impact = document.getElementById("spImpactList");
  impact.innerHTML = `<div class="sp-impact-head">EXPECTED EQUIPMENT BEHAVIOUR</div>` + (sp.targets||[]).map(t => {
    const dev = DEVICES[t];
    return `<div class="sp-impact-row">
      <span class="arrow">→</span>
      <span class="target">${dev?dev.name:t}</span>
      <span class="effect">${sp.behaviour}</span>
    </div>`;
  }).join("");
  document.getElementById("spNotice").classList.remove("hidden");
}
function applyPendingSp() {
  if (!pendingSp) return;
  const sp = (window.SETPOINTS||[]).find(x => x.id === pendingSp.spId);
  if (!sp) return;
  sp.current = pendingSp.newValue;
  sp.source  = `Operator override · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
  toast(`Set point override applied · ${sp.name} = ${sp.current} ${sp.unit}`, "ok");
  document.getElementById("spNotice").classList.add("hidden");
  pendingSp = null;
  refreshSetpointAllViews(sp.id);
}
function refreshSetpointAllViews(spId) {
  // Re-render the affected sp card in every place it's shown
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId); if (!sp) return;
  document.querySelectorAll(`.sp-card[data-sp-id="${spId}"]`).forEach(old => {
    const fresh = renderSetpointCard(sp);
    old.replaceWith(fresh);
  });
  document.querySelectorAll(`.sp-tile[data-sp-id="${spId}"]`).forEach(old => {
    const fresh = renderSetpointTile(sp);
    old.replaceWith(fresh);
  });
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
  tile.innerHTML = `
    <div class="sp-tile-head">
      <div class="sp-icon-tile">${sp.type.slice(0,3).toUpperCase()}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="sp-type-tag">${sp.type}</span>
          ${sp.active ? '' : '<span class="sp-type-tag" style="background:#fdeaea;color:#aa1c1c">INACTIVE</span>'}
        </div>
        <div class="sp-tile-name" style="margin-top:6px">${sp.name}</div>
        <div class="sp-tile-equip">${sp.equipment}</div>
      </div>
    </div>
    <div class="sp-tile-current">${sp.current}<span class="unit">${sp.unit}</span></div>
    <div class="sp-range-bar">${rangeBarHtml(sp)}</div>
    <div class="sp-range-ticks">
      <span>min ${sp.min}${sp.unit}</span>
      <span>safe ${sp.safeMin}–${sp.safeMax}${sp.unit}</span>
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
  if (p === "setpoints") { $("#view-setpoints").classList.remove("hidden"); renderSetpointsPage(); }
  else if (p === "config") { window.location.href = "configuration/"; return; }
  else { $("#view-layout").classList.remove("hidden"); requestAnimationFrame(renderScada); }
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

  // Group panel
  $("#openGroupControl")?.addEventListener("click", openGroupPanel);
  $("#closeGroupPanel")?.addEventListener("click", closeGroupPanel);
  $("#refreshStatus")?.addEventListener("click", () => toast("Status refreshed", "ok"));

  // Equipment drawer
  $("#closeEqDrawer")?.addEventListener("click", closeEqDrawer);

  // Set point notice modal
  $("#spNoticeCancel")?.addEventListener("click", () => { document.getElementById("spNotice").classList.add("hidden"); pendingSp = null; });
  $("#spNoticeConfirm")?.addEventListener("click", applyPendingSp);

  // Set Points filters
  $("#spSearch")?.addEventListener("input", renderSetpointsPage);
  $("#spTypeFilter")?.addEventListener("change", renderSetpointsPage);

  // Zoom controls
  $("#zoomIn")?.addEventListener("click", () => zoomBy(1/1.25));
  $("#zoomOut")?.addEventListener("click", () => zoomBy(1.25));
  $("#zoomFit")?.addEventListener("click", () => { if (viewState.defaultBox) setViewBox(viewState.defaultBox, true); });

  // Initial render
  renderScada();
});
