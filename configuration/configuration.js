// =====================================================================
// Set-Point Configuration — list + Add/Edit modal
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
function schemaForType(t) {
  if (t === "PT (Pressure Transmitter)") return "pt";
  if (t === "LT (Transfer Pump)") return "lt";
  if (t === "Switchover Time") return "switchover";
  return "thresholds";
}

function openSpModal(spId) {
  editingSpId = spId;
  const sp = spId ? (window.SETPOINTS||[]).find(x => x.id === spId) : null;
  $("#spModalTitle").textContent = sp ? "Edit set point" : "Add set point";
  $("#mType").value = sp?.type || "Level";
  $("#mName").value = sp?.name || "";
  $("#mHmiTag").value = sp?.hmiTag || "";
  $("#mActive").checked = sp ? !!sp.active : true;
  renderSchemaFields(sp);
  renderEquipmentChips(sp?.targets || []);
  renderHistorySection(sp);
  updateUnitLabels();
  $("#spModal").classList.remove("hidden");
}

function renderSchemaFields(sp) {
  const host = $("#mSchemaFields"); if (!host) return;
  const schema = schemaForType($("#mType").value);
  if (schema === "lt") {
    host.innerHTML = `
      <div class="cfg-section-label"><span>Transfer pump tank levels</span><span class="cfg-help">All four values are required.</span></div>
      <div class="cfg-lt-block">
        <div class="cfg-lt-title">Intake Tank</div>
        <div class="cfg-grid-2">
          <div class="cfg-field"><label>Min Intake Level</label>
            <div class="cfg-input"><input type="number" step="any" id="fldIntakeMin" value="${sp?.intakeMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
          <div class="cfg-field"><label>Max Intake Level</label>
            <div class="cfg-input"><input type="number" step="any" id="fldIntakeMax" value="${sp?.intakeMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
        </div>
      </div>
      <div class="cfg-lt-block">
        <div class="cfg-lt-title">Outlet Tank</div>
        <div class="cfg-grid-2">
          <div class="cfg-field"><label>Min Outlet Level</label>
            <div class="cfg-input"><input type="number" step="any" id="fldOutletMin" value="${sp?.outletMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
          <div class="cfg-field"><label>Max Outlet Level</label>
            <div class="cfg-input"><input type="number" step="any" id="fldOutletMax" value="${sp?.outletMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
        </div>
      </div>
    `;
  } else if (schema === "pt") {
    host.innerHTML = `
      <div class="cfg-section-label"><span>Pressure thresholds</span><span class="cfg-help">Maximum is required; minimum is optional per plant.</span></div>
      <div class="cfg-grid-2">
        <div class="cfg-field">
          <label>Max Pressure <span class="req">required</span></label>
          <div class="cfg-input"><input type="number" step="any" id="mMax" value="${sp?.max ?? ""}"><span class="unit m-unit-suffix">—</span></div>
        </div>
        <div class="cfg-field">
          <label>Min Pressure (optional)</label>
          <div class="cfg-input"><input type="number" step="any" id="mMin" value="${sp?.min ?? ""}"><span class="unit m-unit-suffix">—</span></div>
        </div>
      </div>
    `;
  } else if (schema === "switchover") {
    host.innerHTML = `
      <div class="cfg-section-label"><span>Switchover Time</span><span class="cfg-help">Applies to all linked equipment as one duty/standby group.</span></div>
      <div class="cfg-field">
        <label>Switchover duration</label>
        <div class="cfg-input"><input type="number" step="1" id="mSwitchover" value="${sp?.switchoverTime ?? ""}"><span class="unit m-unit-suffix">min</span></div>
      </div>
    `;
  } else {
    // thresholds: generic Min/Max
    host.innerHTML = `
      <div class="cfg-grid-2">
        <div class="cfg-field"><label>Min threshold</label>
          <div class="cfg-input"><input type="number" step="any" id="mMin" value="${sp?.min ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
        <div class="cfg-field"><label>Max threshold</label>
          <div class="cfg-input"><input type="number" step="any" id="mMax" value="${sp?.max ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      </div>
    `;
  }
}

function renderHistorySection(sp) {
  const wrap = $("#spHistory");
  const list = $("#spHistoryList");
  if (!wrap || !list) return;
  list.innerHTML = "";
  if (!sp || !sp.history || !sp.history.length) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  // Sort newest first
  const items = [...sp.history].sort((a,b) => (new Date(b.ts)) - (new Date(a.ts)));
  const unit = sp.unit || "";
  for (const h of items) {
    const row = document.createElement("div");
    row.className = "sp-history-item";
    const when = new Date(h.ts);
    const whenStr = when.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    if (h.kind === "value") {
      row.innerHTML = `
        <div class="hi-dot value"></div>
        <div class="hi-body">
          <div class="hi-line"><b>From ${h.from} ${unit}</b><span class="arrow">→</span><b>To ${h.to} ${unit}</b></div>
          <div class="hi-meta">${whenStr} · ${h.who||"unknown"}${h.note?` · <i>${h.note}</i>`:""}</div>
        </div>`;
    } else if (h.kind === "config") {
      const changes = Object.entries(h.changes||{}).map(([k,v]) => `${k}: ${v.from} → ${v.to}`).join(" · ");
      row.innerHTML = `
        <div class="hi-dot config"></div>
        <div class="hi-body">
          <div class="hi-line"><b>Config updated</b><span class="hi-tag">range/state</span></div>
          <div class="hi-meta">${whenStr} · ${h.who||"unknown"} · ${changes}</div>
        </div>`;
    }
    list.appendChild(row);
  }
}

function closeSpModal() {
  editingSpId = null;
  $("#spModal").classList.add("hidden");
}

const TYPE_UNIT = {
  "Level": "%", "DO": "ppm",
  "Differential Pressure": "bar", "Differential Pressure (calculated)": "bar",
  "pH": "pH", "FRC": "ppm", "ORP": "mV", "Flow": "m³/hr", "Time": "s",
  "PT (Pressure Transmitter)": "bar",
  "LT (Transfer Pump)": "m",
  "Switchover Time": "min",
};
function updateUnitLabels() {
  const t = $("#mType").value;
  const u = TYPE_UNIT[t] || (window.SP_TYPE_DEFAULTS||{})[t]?.unit || "";
  document.querySelectorAll(".m-unit-suffix").forEach(el => el.textContent = u || "—");
  const disp = $("#mUnitDisplay");
  if (disp) disp.innerHTML = u ? `<b>${u}</b><span class="ud-sub">${typeBlurb(t)}</span>` : "—";
}

function typeBlurb(t) {
  switch (t) {
    case "DO":   return "dissolved oxygen";
    case "pH":   return "pH units";
    case "Level": return "tank level %";
    case "Differential Pressure":
    case "Differential Pressure (calculated)": return "pressure";
    case "FRC":  return "free residual chlorine";
    case "ORP":  return "redox potential";
    case "Flow": return "flow rate";
    case "Time": return "duration in seconds";
    default: return "";
  }
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
  const active = $("#mActive").checked;
  const targets = Array.from(msSelected);
  const schema = schemaForType(type);

  if (!name) return toast("Name is required", "bad");
  if (!hmiTag) return toast("HMI Set Point Tag is required", "bad");
  if (!targets.length) return toast("Link at least one equipment", "bad");

  // Schema-driven fields
  const fields = {};
  if (schema === "lt") {
    const a = parseFloat($("#fldIntakeMin").value);
    const b = parseFloat($("#fldIntakeMax").value);
    const c = parseFloat($("#fldOutletMin").value);
    const d = parseFloat($("#fldOutletMax").value);
    if ([a,b,c,d].some(isNaN)) return toast("All four levels must be numbers", "bad");
    if (b <= a) return toast("Intake Max must be greater than Intake Min", "bad");
    if (d <= c) return toast("Outlet Max must be greater than Outlet Min", "bad");
    Object.assign(fields, { intakeMin:a, intakeMax:b, outletMin:c, outletMax:d, min:a, max:b });
  } else if (schema === "pt") {
    const max = parseFloat($("#mMax").value);
    const minRaw = $("#mMin").value;
    const min = minRaw === "" ? null : parseFloat(minRaw);
    if (isNaN(max)) return toast("Max pressure is required", "bad");
    if (min !== null && !isNaN(min) && max <= min) return toast("Max must be greater than Min", "bad");
    Object.assign(fields, { max, min: (min ?? 0) });
  } else if (schema === "switchover") {
    const t = parseFloat($("#mSwitchover").value);
    if (isNaN(t) || t <= 0) return toast("Switchover time must be a positive number", "bad");
    Object.assign(fields, { switchoverTime: t, min: 1, max: t * 4 });
  } else {
    const min = parseFloat($("#mMin").value);
    const max = parseFloat($("#mMax").value);
    if (isNaN(min) || isNaN(max)) return toast("Min and Max must be numbers", "bad");
    if (max <= min) return toast("Max must be greater than Min", "bad");
    Object.assign(fields, { min, max });
  }

  const unit = TYPE_UNIT[type] || (window.SP_TYPE_DEFAULTS||{})[type]?.unit || "";
  const list = window.SETPOINTS || (window.SETPOINTS = []);

  if (editingSpId) {
    const sp = list.find(x => x.id === editingSpId);
    if (sp) {
      const changes = {};
      for (const k of Object.keys(fields)) {
        if (sp[k] !== fields[k]) changes[k] = { from: sp[k], to: fields[k] };
      }
      if (sp.active !== active) changes.active = { from: sp.active, to: active };
      if (Object.keys(changes).length) {
        sp.history = sp.history || [];
        sp.history.push({ ts: new Date().toISOString(), kind: "config", changes, who: "you" });
      }
      Object.assign(sp, { type, name, hmiTag, unit, active, targets, ...fields });
      if (sp.current != null && fields.min != null && sp.current < fields.min) sp.current = fields.min;
      if (sp.current != null && fields.max != null && sp.current > fields.max) sp.current = fields.max;
      sp.source = `Configured · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
      toast(`Updated: ${name}`, "ok");
    }
  } else {
    const id = "sp-" + Date.now().toString(36);
    const initialCurrent = schema === "switchover" ? fields.switchoverTime
                          : (fields.min != null && fields.max != null ? (fields.min + fields.max) / 2 : 0);
    list.push({
      id, type, name, hmiTag, unit, active, targets, ...fields,
      equipment: targets.length ? "Linked equipment" : "Unassigned",
      current: initialCurrent,
      source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
      history: [{ ts: new Date().toISOString(), kind: "config", changes: { created: { from: "—", to: "—" } }, who: "you", note: "Created" }],
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
  $("#mType")?.addEventListener("change", () => { renderSchemaFields(null); updateUnitLabels(); });
  $("#msTrigger")?.addEventListener("click", e => { e.stopPropagation(); toggleMsMenu(); });
  $("#msMenuSearch")?.addEventListener("input", e => { msMenuSearch = e.target.value.toLowerCase(); renderMsList(); });
  $("#msSelectAll")?.addEventListener("click", () => { EQUIPMENT_CATALOG.forEach(eq => msSelected.add(eq.id)); renderMsTrigger(); renderMsList(); });
  $("#msClearAll")?.addEventListener("click", () => { msSelected.clear(); renderMsTrigger(); renderMsList(); });
  document.addEventListener("click", e => { if (!e.target.closest("#msEquipment")) { $("#msMenu")?.classList.add("hidden"); $("#msTrigger")?.setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSpModal(); $("#msMenu")?.classList.add("hidden"); } });
});
