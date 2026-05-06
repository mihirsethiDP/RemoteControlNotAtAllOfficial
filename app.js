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

// ---------- SCADA SVG device drawing ----------
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
  // Pumps
  document.querySelectorAll(".pump-svg").forEach(g => {
    const id = g.dataset.id;
    drawPumpSvg(g, DEVICES[id]?.on);
  });
  // Valves
  document.querySelectorAll(".valve-svg").forEach(g => {
    const id = g.dataset.id;
    drawValveSvg(g, DEVICES[id]?.on, g.classList.contains("air"));
  });
  // Blowers
  document.querySelectorAll(".blower-svg").forEach(g => {
    const id = g.dataset.id;
    const idx = id.replace("BLOWER", "");
    drawBlowerSvg(g, DEVICES[id]?.on, idx);
  });
  // Decanter
  document.querySelectorAll(".decanter-svg").forEach(g => {
    drawDecanterSvg(g, DEVICES[g.dataset.id]?.on);
  });
  positionOverlays();
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
  const layer = document.getElementById("overlayLayer");
  if (!layer) return;
  const wrap = document.querySelector(".scada-wrap");
  const svg = document.querySelector(".scada");
  if (!wrap || !svg) return;
  const wrapRect = wrap.getBoundingClientRect();

  // Build/refresh overlay for each device
  for (const id of Object.keys(ANCHORS)) {
    const node = svg.querySelector(`[data-id="${id}"]`);
    if (!node) continue;
    const bb = node.getBoundingClientRect();
    const cx = bb.left - wrapRect.left + bb.width / 2;
    const cy = bb.bottom - wrapRect.top + 4;

    let ctl = layer.querySelector(`.ctl[data-id="${id}"]`);
    if (!ctl) {
      ctl = document.createElement("div");
      ctl.className = "ctl";
      ctl.dataset.id = id;
      layer.appendChild(ctl);
    }
    ctl.style.left = cx + "px";
    ctl.style.top  = cy + "px";

    // refill
    const d = DEVICES[id];
    ctl.innerHTML = "";
    const pill = document.createElement("span");
    pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
    pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
    ctl.appendChild(pill);
    const lab = document.createElement("label"); lab.className = "switch";
    const inp = document.createElement("input");
    inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
    inp.addEventListener("change", e => attemptToggle(id, e.target.checked, ctl));
    const sl = document.createElement("span"); sl.className = "slider";
    lab.append(inp, sl); ctl.appendChild(lab);
  }
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
  toast("Remote control ENGAGED. PLC handover complete.", "warn");
  renderAll();
}
function releaseRemote(reason) {
  remoteActive = false;
  Object.values(DEVICES).forEach(d => d.mode = "local");
  if (remoteTimerId) { clearInterval(remoteTimerId); remoteTimerId = null; }
  remoteEndsAt = null;
  $("#timerChip").classList.add("hidden");
  toast(reason || "Returned to LOCAL (PLC) control.", "ok");
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
    // overlays need the SVG to be laid out
    requestAnimationFrame(() => positionOverlays());
  }
}

// ---------- Wire up ----------
document.addEventListener("DOMContentLoaded", () => {
  $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));

  // Engineering tank disclosure
  $$(".disclosure-btn").forEach(b => b.addEventListener("click", () => toggleTankExpand(b.dataset.tank)));
  // SCADA tank-expand buttons
  $$(".tank-expand-btn").forEach(b => b.addEventListener("click", () => toggleTankExpand(b.dataset.tank)));

  // Reposition overlays on resize/scroll
  window.addEventListener("resize", positionOverlays);
  window.addEventListener("scroll", positionOverlays, true);

  $("#masterRemote").addEventListener("change", e => {
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
    activateRemote(dur);
  });
  $("#cancelRelease").addEventListener("click", () => $("#releaseModal").classList.add("hidden"));
  $("#confirmRelease").addEventListener("click", () => { $("#releaseModal").classList.add("hidden"); releaseRemote(); });
  $("#cancelRemote").addEventListener("click", () => $("#releaseModal").classList.remove("hidden"));

  renderAll();
});
