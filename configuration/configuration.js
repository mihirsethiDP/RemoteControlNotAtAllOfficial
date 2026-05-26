// =====================================================================
// Set-Point Parent Configuration — list + Add/Edit modal
// =====================================================================

const EQUIPMENT_CATALOG = [
  { id:"SBR1_INLET", name:"SBR 1 Inlet Valve" },
  { id:"SBR2_INLET", name:"SBR 2 Inlet Valve" },
  { id:"AIR1", name:"SBR 1 Air Inlet Line" },
  { id:"AIR2", name:"SBR 2 Air Inlet Line" },
  { id:"BLOWER1", name:"SBR Blower 1" },
  { id:"BLOWER2", name:"SBR Blower 2" },
  { id:"BLOWER3", name:"SBR Blower 3" },
  { id:"BLOWER4", name:"SBR Blower 4" },
  { id:"DECANTER", name:"SBR Decanter" },
  { id:"RECIRC_A1", name:"Re-Circulation Pump A1" },
  { id:"RECIRC_A2", name:"Re-Circulation Pump A2" },
  { id:"SLUDGE_A1", name:"Sludge Sump Pump A1" },
  { id:"SLUDGE_A2", name:"Sludge Sump Pump A2" },
  { id:"RECIRC_B1", name:"Re-Circulation Pump B1" },
  { id:"RECIRC_B2", name:"Re-Circulation Pump B2" },
  { id:"SLUDGE_B1", name:"Sludge Sump Pump B1" },
  { id:"SLUDGE_B2", name:"Sludge Sump Pump B2" },
];

let editingSpId = null;

function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }
let toastT;
function toast(msg, kind="") {
  const t = $("#toast"); t.className = "toast " + kind; t.textContent = msg;
  t.classList.remove("hidden"); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ----------- List rendering (Data-Input inspired table) -----------
function renderList() {
  const tbl = $("#cfgTable"); if (!tbl) return;
  tbl.innerHTML = "";
  const search = ($("#cfgSearch")?.value || "").toLowerCase();
  const tFilter = $("#cfgFilter")?.value || "";
  const sps = (window.SETPOINTS||[]).filter(sp => {
    if (tFilter && sp.type !== tFilter) return false;
    if (search) {
      const hay = (sp.name + " " + sp.equipment + " " + sp.type + " " + (sp.hmiTag||"")).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  $("#cfgCount").textContent = `${sps.length} configured`;

  const header = document.createElement("div");
  header.className = "cfg-trow cfg-thead";
  header.innerHTML = `
    <div>Set Point</div>
    <div>Range</div>
    <div>HMI Tag</div>
    <div>Linked Equipment</div>
    <div>Type</div>
    <div>Status</div>
    <div></div>
  `;
  tbl.appendChild(header);

  if (!sps.length) {
    const empty = document.createElement("div");
    empty.className = "cfg-empty-row";
    empty.textContent = "No set points configured. Click + Add set point to create one.";
    tbl.appendChild(empty);
    return;
  }

  for (const sp of sps) {
    const row = document.createElement("div");
    row.className = "cfg-trow cfg-tbody";
    row.dataset.id = sp.id;
    const eqNames = (sp.targets||[]).map(t => EQUIPMENT_CATALOG.find(e => e.id===t)?.name || t);
    row.innerHTML = `
      <div class="c-name">
        <div class="c-name-main">${sp.name}</div>
        <div class="c-name-sub">${sp.equipment}</div>
      </div>
      <div class="c-range">
        <div class="range-line">Allowed: <b>${sp.min} – ${sp.max} ${sp.unit}</b></div>
      </div>
      <div class="c-hmi"><code>${sp.hmiTag||"—"}</code></div>
      <div class="c-eq">
        ${eqNames.length ? `<span class="c-eq-main">${eqNames[0]}</span>` + (eqNames.length>1?`<span class="c-eq-rest">+${eqNames.length-1} more</span>`:"") : '<span class="muted">None linked</span>'}
      </div>
      <div class="c-type"><span class="c-type-pill">${sp.type}</span></div>
      <div class="c-status"><span class="r-tag-pill ${sp.active?'on':'off'}">${sp.active?'ENABLED':'DISABLED'}</span></div>
      <div class="c-act"><button class="ic-btn" title="Edit set point">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
      </button></div>
    `;
    row.querySelector(".ic-btn").addEventListener("click", e => { e.stopPropagation(); openSpModal(sp.id); });
    row.addEventListener("click", e => { if (!e.target.closest(".ic-btn")) openSpModal(sp.id); });
    tbl.appendChild(row);
  }
}

// ----------- Modal -----------
function openSpModal(spId) {
  editingSpId = spId;
  const sp = spId ? (window.SETPOINTS||[]).find(x => x.id === spId) : null;
  $("#spModalTitle").textContent = sp ? "Edit set point" : "Add set point";
  $("#mType").value = sp?.type || "Level";
  $("#mName").value = sp?.name || "";
  $("#mHmiTag").value = sp?.hmiTag || "";
  $("#mMin").value = sp?.min ?? "";
  $("#mMax").value = sp?.max ?? "";
  $("#mActive").checked = sp ? !!sp.active : true;
  updateUnitLabels();
  renderEquipmentChips(sp?.targets || []);
  $("#spModal").classList.remove("hidden");
}

function closeSpModal() {
  editingSpId = null;
  $("#spModal").classList.add("hidden");
}

function updateUnitLabels() {
  const t = $("#mType").value;
  const u = (window.SP_TYPE_DEFAULTS||{})[t]?.unit || "";
  $("#mUnitMin").textContent = u;
  $("#mUnitMax").textContent = u;
}

// Multi-select dropdown state
let msSelected = new Set();
let msMenuSearch = "";

function renderEquipmentChips(selectedIds) {
  msSelected = new Set(selectedIds);
  msMenuSearch = "";
  if ($("#msMenuSearch")) $("#msMenuSearch").value = "";
  $("#msMenu")?.classList.add("hidden");
  $("#msTrigger")?.setAttribute("aria-expanded", "false");
  renderMsTrigger();
  renderMsList();
}

function renderMsTrigger() {
  const text = $("#msTriggerText");
  const trig = $("#msTrigger");
  if (!text || !trig) return;
  trig.classList.toggle("has-selection", msSelected.size > 0);
  if (!msSelected.size) {
    text.textContent = "Select equipment…";
    text.innerHTML = `<span class="ms-placeholder">Select equipment…</span>`;
  } else {
    const names = EQUIPMENT_CATALOG.filter(e => msSelected.has(e.id)).map(e => e.name);
    // Show up to 2 chips + "+N more"
    const visible = names.slice(0, 2);
    const extra = names.length - visible.length;
    text.innerHTML = visible.map(n => `<span class="ms-chip">${n}</span>`).join("") +
                     (extra > 0 ? `<span class="ms-chip more">+${extra} more</span>` : "");
  }
  updateEqCount();
}

function renderMsList() {
  const list = $("#msMenuList"); if (!list) return;
  list.innerHTML = "";
  const items = EQUIPMENT_CATALOG.filter(eq =>
    !msMenuSearch || eq.name.toLowerCase().includes(msMenuSearch));
  if (!items.length) {
    list.innerHTML = `<div class="ms-empty">No equipment matches "${msMenuSearch}"</div>`;
    return;
  }
  for (const eq of items) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ms-item" + (msSelected.has(eq.id) ? " selected" : "");
    item.dataset.id = eq.id;
    item.innerHTML = `
      <span class="ms-check">${msSelected.has(eq.id) ? '<svg width="11" height="11" viewBox="0 0 14 14"><path d="M2,7 L5.5,10.5 L12,3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
      <span class="ms-name">${eq.name}</span>
    `;
    item.addEventListener("click", () => {
      if (msSelected.has(eq.id)) msSelected.delete(eq.id);
      else msSelected.add(eq.id);
      renderMsTrigger();
      renderMsList();
    });
    list.appendChild(item);
  }
}

function updateEqCount() {
  $("#mEqCount").textContent = `${msSelected.size} selected`;
}

function toggleMsMenu() {
  const menu = $("#msMenu");
  const trig = $("#msTrigger");
  const open = !menu.classList.contains("hidden");
  if (open) {
    menu.classList.add("hidden");
    trig.setAttribute("aria-expanded", "false");
  } else {
    menu.classList.remove("hidden");
    trig.setAttribute("aria-expanded", "true");
    $("#msMenuSearch")?.focus();
  }
}

function saveSpFromModal() {
  const type = $("#mType").value;
  const name = $("#mName").value.trim();
  const hmiTag = $("#mHmiTag").value.trim();
  const min = parseFloat($("#mMin").value);
  const max = parseFloat($("#mMax").value);
  const active = $("#mActive").checked;
  const targets = Array.from(msSelected);

  if (!name) return toast("Name is required", "bad");
  if (!hmiTag) return toast("HMI Set Point Tag is required", "bad");
  if (isNaN(min) || isNaN(max)) return toast("Min and Max must be numbers", "bad");
  if (max <= min) return toast("Max must be greater than Min", "bad");
  if (!targets.length) return toast("Link at least one equipment", "bad");

  const unit = (window.SP_TYPE_DEFAULTS||{})[type]?.unit || "";
  const list = window.SETPOINTS || (window.SETPOINTS = []);

  if (editingSpId) {
    const sp = list.find(x => x.id === editingSpId);
    if (sp) {
      Object.assign(sp, { type, name, hmiTag, min, max, unit, active, targets });
      if (sp.current < min) sp.current = min;
      if (sp.current > max) sp.current = max;
      sp.source = `Parent config · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
      toast(`Updated: ${name}`, "ok");
    }
  } else {
    const id = "sp-" + Date.now().toString(36);
    list.push({
      id, type, name, hmiTag, min, max, unit, active, targets,
      equipment: targets.length ? "Linked equipment" : "Unassigned",
      current: (min + max) / 2,
      source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
    });
    toast(`Added: ${name}`, "ok");
  }

  closeSpModal();
  renderList();
}

document.addEventListener("DOMContentLoaded", () => {
  renderList();
  $("#cfgSearch")?.addEventListener("input", renderList);
  $("#cfgFilter")?.addEventListener("change", renderList);
  $("#addSpBtn")?.addEventListener("click", () => openSpModal(null));
  $("#spModalClose")?.addEventListener("click", closeSpModal);
  $("#spModalCancel")?.addEventListener("click", closeSpModal);
  $("#spModalSave")?.addEventListener("click", saveSpFromModal);
  $("#mType")?.addEventListener("change", updateUnitLabels);
  $("#msTrigger")?.addEventListener("click", e => { e.stopPropagation(); toggleMsMenu(); });
  $("#msMenuSearch")?.addEventListener("input", e => { msMenuSearch = e.target.value.toLowerCase(); renderMsList(); });
  $("#msSelectAll")?.addEventListener("click", () => { EQUIPMENT_CATALOG.forEach(eq => msSelected.add(eq.id)); renderMsTrigger(); renderMsList(); });
  $("#msClearAll")?.addEventListener("click", () => { msSelected.clear(); renderMsTrigger(); renderMsList(); });
  document.addEventListener("click", e => { if (!e.target.closest("#msEquipment")) { $("#msMenu")?.classList.add("hidden"); $("#msTrigger")?.setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSpModal(); $("#msMenu")?.classList.add("hidden"); } });
});
