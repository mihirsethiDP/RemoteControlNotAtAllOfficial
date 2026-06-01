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
  $("#view-layout").classList.remove("hidden");
  requestAnimationFrame(renderScada);
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
