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

// ---------- Visualization view rendering ----------
function renderVizNode(nodeEl) {
  const id = nodeEl.dataset.id;
  if (!id) return;
  const d = DEVICES[id];
  nodeEl.classList.toggle("on", d.on);
  // Inject inline control popover
  let ctl = nodeEl.querySelector(".ctl");
  if (!ctl) {
    ctl = document.createElement("div");
    ctl.className = "ctl";
    nodeEl.appendChild(ctl);
  }
  ctl.innerHTML = "";
  const pill = document.createElement("span");
  pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
  pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
  ctl.appendChild(pill);
  const lab = document.createElement("label"); lab.className = "switch";
  const inp = document.createElement("input");
  inp.type = "checkbox"; inp.checked = d.on; inp.disabled = d.mode !== "remote";
  inp.addEventListener("change", e => attemptToggle(id, e.target.checked, nodeEl));
  const sl = document.createElement("span"); sl.className = "slider";
  lab.append(inp, sl); ctl.appendChild(lab);
}

function renderVizTankInternals(tankId) {
  const host = document.querySelector(`[data-viz-internals="${tankId}"]`);
  if (!host) return;
  host.innerHTML = "";
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
}

function renderAll() {
  // Engineering devices
  $$("#view-engineering .device").forEach(renderEngDevice);
  // Engineering tanks: re-render internals if expanded
  ["BASIN1","BASIN2"].forEach(t => {
    if (document.querySelector(`.tank-card[data-tank="${t}"]`)?.classList.contains("expanded")) {
      renderEngTankInternals(t);
    }
  });
  // Viz nodes
  $$("#view-viz .viz-node").forEach(renderVizNode);
  ["BASIN1","BASIN2"].forEach(t => {
    if (document.querySelector(`.viz-tank[data-tank="${t}"]`)?.classList.contains("expanded")) {
      renderVizTankInternals(t);
    }
  });
  // Counts
  const total = Object.keys(DEVICES).length;
  $("#sbrCount").textContent = `${total} equipment`;
  ["BASIN1","BASIN2"].forEach(t => {
    const list = Object.values(DEVICES).filter(d => d.loc === t);
    const active = list.filter(d => d.on).length;
    const id = t === "BASIN1" ? "basin1Summary" : "basin2Summary";
    if ($("#"+id)) $("#"+id).textContent = `${list.length} pumps · ${active} active`;
    const vCount = $(`#vizBasin${t === "BASIN1" ? 1 : 2}Count`);
    const vAct = $(`#vizBasin${t === "BASIN1" ? 1 : 2}Active`);
    if (vCount) vCount.textContent = list.length;
    if (vAct) vAct.textContent = `${active} active`;
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
  hostEl.querySelectorAll(".interlock-msg, .interlock").forEach(n => n.remove());
  const m = document.createElement("div");
  // Use small inline form on viz, larger on engineering
  if (hostEl.closest(".viz-canvas")) {
    m.className = "ctl interlock";
    m.style.top = "calc(100% + 36px)";
    m.textContent = msg;
    hostEl.appendChild(m);
  } else {
    m.className = "interlock-msg";
    m.textContent = msg;
    hostEl.appendChild(m);
  }
  hostEl.classList.add("blocked");
  setTimeout(() => { m.remove(); hostEl.classList.remove("blocked"); }, 3500);
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
  // Viz view
  const vt = document.querySelector(`.viz-tank[data-tank="${tankId}"]`);
  if (vt) {
    const wasExpanded = vt.classList.toggle("expanded");
    const internals = vt.querySelector(".viz-tank-internals");
    internals.classList.toggle("hidden", !wasExpanded);
    const btn = vt.querySelector(".viz-expand");
    if (btn) btn.textContent = wasExpanded ? "▾ Collapse" : "▸ Expand";
    if (wasExpanded) {
      // grow tank to fit
      vt.style.height = "auto";
      renderVizTankInternals(tankId);
    } else {
      vt.style.height = "240px";
    }
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
}

// ---------- Wire up ----------
document.addEventListener("DOMContentLoaded", () => {
  $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));

  // Engineering tank disclosure
  $$(".disclosure-btn").forEach(b => b.addEventListener("click", () => toggleTankExpand(b.dataset.tank)));
  // Viz tank disclosure
  $$(".viz-expand").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    toggleTankExpand(b.dataset.tank);
  }));

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
