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

// ----------- List rendering -----------
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
  header.className = "cfg-row-h";
  header.innerHTML = `
    <div>Type</div>
    <div>Name · HMI Tag</div>
    <div>Linked Equipment</div>
    <div>Range</div>
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
    row.className = "cfg-row-r";
    row.dataset.id = sp.id;
    const eqNames = (sp.targets||[]).map(t => EQUIPMENT_CATALOG.find(e => e.id===t)?.name || t);
    row.innerHTML = `
      <div><span class="ic">${sp.type.slice(0,3).toUpperCase()}</span></div>
      <div>
        <div class="r-name">${sp.name}</div>
        <code class="r-tag">${sp.hmiTag||"—"}</code>
      </div>
      <div class="r-eq">${eqNames.length ? eqNames.slice(0,3).join(", ") + (eqNames.length>3?` <span class="muted">+${eqNames.length-3}</span>`:"") : '<span class="muted">None</span>'}</div>
      <div class="r-range">${sp.min} – ${sp.max} <span class="unit">${sp.unit}</span></div>
      <div><span class="r-tag-pill ${sp.active?'on':'off'}">${sp.active?'ENABLED':'DISABLED'}</span></div>
      <div><button class="r-edit">Edit</button></div>
    `;
    row.querySelector(".r-edit").addEventListener("click", () => openSpModal(sp.id));
    row.addEventListener("click", e => { if (!e.target.closest(".r-edit")) openSpModal(sp.id); });
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

function renderEquipmentChips(selectedIds) {
  const host = $("#mEquipment");
  host.innerHTML = "";
  const sel = new Set(selectedIds);
  for (const eq of EQUIPMENT_CATALOG) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "multi-chip" + (sel.has(eq.id) ? " selected" : "");
    chip.dataset.id = eq.id;
    chip.textContent = eq.name;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
      updateEqCount();
    });
    host.appendChild(chip);
  }
  updateEqCount();
}

function updateEqCount() {
  const n = $("#mEquipment").querySelectorAll(".multi-chip.selected").length;
  $("#mEqCount").textContent = `${n} selected`;
}

function saveSpFromModal() {
  const type = $("#mType").value;
  const name = $("#mName").value.trim();
  const hmiTag = $("#mHmiTag").value.trim();
  const min = parseFloat($("#mMin").value);
  const max = parseFloat($("#mMax").value);
  const active = $("#mActive").checked;
  const targets = Array.from($("#mEquipment").querySelectorAll(".multi-chip.selected")).map(c => c.dataset.id);

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
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSpModal(); });
});
