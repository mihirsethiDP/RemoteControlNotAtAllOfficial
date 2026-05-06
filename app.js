// ---------- Equipment model ----------
// Each device: id, name, group, type, location ('main' or tank id), state (on/off), mode ('local'|'remote')
const DEVICES = {
  // Main SBR group
  SBR1_INLET: { name: "SBR-1 Inlet Valve", group: "sbr", type: "valve", loc: "main" },
  SBR2_INLET: { name: "SBR-2 Inlet Valve", group: "sbr", type: "valve", loc: "main" },
  BLOWER1:    { name: "SBR Blower 1", group: "sbr", type: "blower", loc: "main" },
  BLOWER2:    { name: "SBR Blower 2", group: "sbr", type: "blower", loc: "main" },
  BLOWER3:    { name: "SBR Blower 3", group: "sbr", type: "blower", loc: "main" },
  BLOWER4:    { name: "SBR Blower 4", group: "sbr", type: "blower", loc: "main" },
  AIR1:       { name: "SBR-1 Air Inlet Line", group: "sbr", type: "valve", loc: "main" },
  AIR2:       { name: "SBR-2 Air Inlet Line", group: "sbr", type: "valve", loc: "main" },
  DECANTER:   { name: "SBR Decanter", group: "sbr", type: "decanter", loc: "main" },
  // Inside Basin 1
  RECIRC_A1:  { name: "Re-Circulation Pump A1", group: "sbr", type: "pump", loc: "BASIN1" },
  RECIRC_A2:  { name: "Re-Circulation Pump A2", group: "sbr", type: "pump", loc: "BASIN1" },
  SLUDGE_A1:  { name: "Sludge Sump Pump A1", group: "sbr", type: "pump", loc: "BASIN1" },
  SLUDGE_A2:  { name: "Sludge Sump Pump A2", group: "sbr", type: "pump", loc: "BASIN1" },
  // Inside Basin 2
  RECIRC_B1:  { name: "Re-Circulation Pump B1", group: "sbr", type: "pump", loc: "BASIN2" },
  RECIRC_B2:  { name: "Re-Circulation Pump B2", group: "sbr", type: "pump", loc: "BASIN2" },
  SLUDGE_B1:  { name: "Sludge Sump Pump B1", group: "sbr", type: "pump", loc: "BASIN2" },
  SLUDGE_B2:  { name: "Sludge Sump Pump B2", group: "sbr", type: "pump", loc: "BASIN2" },
};
Object.values(DEVICES).forEach(d => { d.on = false; d.mode = "local"; });

// Seed a couple ON to mimic running plant
DEVICES.AIR1.on = true; DEVICES.RECIRC_A1.on = true; DEVICES.BLOWER1.on = true;

// ---------- Interlocks ----------
// Returns null if action allowed, or a message string explaining the block.
function checkInterlock(id, nextOn) {
  if (!nextOn) return null; // turning OFF is always allowed in this prototype

  if (id.startsWith("BLOWER")) {
    if (!DEVICES.AIR1.on && !DEVICES.AIR2.on)
      return "Blocked: at least one Air Inlet Line valve (AIR-1 or AIR-2) must be open.";
    if (DEVICES.DECANTER.on)
      return "Blocked: SBR Decanter is ON. Blowers cannot run while decanter is active.";
  }

  if (id === "SBR1_INLET" && DEVICES.DECANTER.on)
    return "Blocked: SBR Decanter is ON. Inlet valve cannot open during decant.";

  return null;
}

// ---------- Remote control state ----------
let remoteActive = false;
let remoteTimerId = null;
let remoteEndsAt = null; // epoch ms, or null = indefinite

// ---------- Rendering ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function renderDevice(devEl) {
  const id = devEl.dataset.id;
  const d = DEVICES[id];
  const controls = devEl.querySelector(".dev-controls");
  controls.innerHTML = "";

  // mode pill
  const pill = document.createElement("span");
  pill.className = "mode-pill sm " + (d.mode === "remote" ? "remote" : "local");
  pill.textContent = d.mode === "remote" ? "REMOTE" : "LOCAL";
  controls.appendChild(pill);

  // toggle switch (only enabled if remote)
  const label = document.createElement("label");
  label.className = "switch";
  const inp = document.createElement("input");
  inp.type = "checkbox";
  inp.checked = d.on;
  inp.disabled = d.mode !== "remote";
  inp.addEventListener("change", e => attemptToggle(id, e.target.checked, devEl));
  const slider = document.createElement("span");
  slider.className = "slider";
  label.append(inp, slider);
  controls.appendChild(label);

  devEl.classList.toggle("on", d.on);
}

function renderAll() {
  $$(".device").forEach(renderDevice);
  // Render any drawer items currently open
  if (!$("#drawer").classList.contains("hidden")) {
    const tankId = $("#drawer").dataset.tank;
    if (tankId) renderDrawer(tankId);
  }
  // Counts
  const total = Object.keys(DEVICES).length;
  $("#sbrCount").textContent = `${total} equipment`;
  $("#basin1Count").textContent = Object.values(DEVICES).filter(d => d.loc === "BASIN1").length;
  $("#basin2Count").textContent = Object.values(DEVICES).filter(d => d.loc === "BASIN2").length;

  // Group + master visuals
  document.querySelector(".group").classList.toggle("remote", remoteActive);
  $("#masterMode").classList.toggle("remote", remoteActive);
  $("#masterMode").classList.toggle("local", !remoteActive);
  $("#masterMode").textContent = remoteActive ? "REMOTE" : "LOCAL (PLC)";
  $("#masterRemote").checked = remoteActive;
}

function attemptToggle(id, nextOn, devEl) {
  const d = DEVICES[id];
  if (d.mode !== "remote") return;
  const block = checkInterlock(id, nextOn);
  if (block) {
    showInterlock(devEl, block);
    renderAll(); // revert checkbox
    return;
  }
  d.on = nextOn;
  toast(`${d.name} → ${nextOn ? "ON" : "OFF"}`, "ok");
  renderAll();
}

function showInterlock(devEl, msg) {
  // Find the host (could be in drawer)
  const host = devEl;
  host.querySelectorAll(".interlock-msg").forEach(n => n.remove());
  const m = document.createElement("div");
  m.className = "interlock-msg";
  m.textContent = msg;
  host.appendChild(m);
  setTimeout(() => m.remove(), 3500);
  host.classList.add("blocked");
  setTimeout(() => host.classList.remove("blocked"), 3500);
}

// ---------- Tank drawer ----------
function openTank(tankId) {
  const drawer = $("#drawer");
  drawer.dataset.tank = tankId;
  drawer.classList.remove("hidden");
  $("#drawerTitle").textContent = tankId === "BASIN1" ? "Zone-3 · CASS Basin 1" : "Zone-3 · CASS Basin 2";
  renderDrawer(tankId);
}
function closeDrawer() {
  $("#drawer").classList.add("hidden");
  $("#drawer").dataset.tank = "";
}
function renderDrawer(tankId) {
  const body = $("#drawerBody");
  body.innerHTML = "";
  Object.entries(DEVICES).filter(([,d]) => d.loc === tankId).forEach(([id, d]) => {
    const el = document.createElement("div");
    el.className = "device";
    el.dataset.id = id;
    el.dataset.type = d.type;
    el.innerHTML = `
      <div class="dev-icon">⏣</div>
      <div class="dev-name">${d.name}</div>
      <div class="dev-controls"></div>`;
    body.appendChild(el);
    renderDevice(el);
  });
}

// ---------- Take / release control flow ----------
function openTakeModal() {
  // Build equipment list grouped by location
  const list = $("#equipList");
  list.innerHTML = "";
  const groups = {
    "Main Section": Object.entries(DEVICES).filter(([,d]) => d.loc === "main"),
    "Inside Zone-3 · CASS Basin 1": Object.entries(DEVICES).filter(([,d]) => d.loc === "BASIN1"),
    "Inside Zone-3 · CASS Basin 2": Object.entries(DEVICES).filter(([,d]) => d.loc === "BASIN2"),
  };
  for (const [grp, items] of Object.entries(groups)) {
    const h = document.createElement("div");
    h.className = "equip-group";
    h.textContent = `${grp} (${items.length})`;
    list.appendChild(h);
    for (const [id, d] of items) {
      const r = document.createElement("div");
      r.className = "equip-row";
      r.innerHTML = `<span>${d.name}</span><span class="tag">${d.type}</span>`;
      list.appendChild(r);
    }
  }
  $("#modal").classList.remove("hidden");
}
function closeTakeModal() {
  $("#modal").classList.add("hidden");
  $("#masterRemote").checked = remoteActive; // revert switch if cancelled
}

function activateRemote(durationSec) {
  remoteActive = true;
  Object.values(DEVICES).forEach(d => d.mode = "remote");
  if (durationSec > 0) {
    remoteEndsAt = Date.now() + durationSec * 1000;
    startTimerTick();
  } else {
    remoteEndsAt = null;
    $("#timerLabel").textContent = "∞ indefinite";
    $("#timerChip").classList.remove("hidden");
  }
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
    if (ms <= 0) {
      releaseRemote("Auto-return: timer expired. Equipment back on PLC.");
      return;
    }
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    $("#timerLabel").textContent = `${mm}:${ss} until auto-release`;
  };
  tick();
  remoteTimerId = setInterval(tick, 500);
}

// ---------- Toast ----------
let toastT;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.className = "toast " + kind;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ---------- Wire up ----------
document.addEventListener("DOMContentLoaded", () => {
  $$(".tank").forEach(el => el.addEventListener("click", () => openTank(el.dataset.tank)));
  $("#closeDrawer").addEventListener("click", closeDrawer);

  $("#masterRemote").addEventListener("change", e => {
    if (e.target.checked && !remoteActive) {
      openTakeModal();
    } else if (!e.target.checked && remoteActive) {
      $("#releaseModal").classList.remove("hidden");
      e.target.checked = true; // hold switch until confirmed
    }
  });

  $("#cancelModal").addEventListener("click", closeTakeModal);
  $("#confirmRemote").addEventListener("click", () => {
    const dur = parseInt($("#duration").value, 10);
    $("#modal").classList.add("hidden");
    activateRemote(dur);
  });

  $("#cancelRelease").addEventListener("click", () => {
    $("#releaseModal").classList.add("hidden");
  });
  $("#confirmRelease").addEventListener("click", () => {
    $("#releaseModal").classList.add("hidden");
    releaseRemote();
  });
  $("#cancelRemote").addEventListener("click", () => {
    $("#releaseModal").classList.remove("hidden");
  });

  renderAll();
});
