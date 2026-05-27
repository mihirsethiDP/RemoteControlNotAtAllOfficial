// =====================================================================
// Set-Point Configuration — type-specific forms + groups + audit
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
let editingGroupId = null;
let cfgTab = "setpoints"; // 'setpoints' or 'groups'

function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }
let toastT;
function toast(msg, kind="") {
  const t = $("#toast"); t.className = "toast " + kind; t.textContent = msg;
  t.classList.remove("hidden"); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
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
    case "Time": return "duration";
    case "LT (Transfer Pump)": return "transfer pump tank levels";
    case "Switchover Time": return "duty/standby alternation";
    default: return "";
  }
}

function currentTypeSchema() {
  const t = $("#mType").value;
  return (window.SP_TYPE_DEFAULTS||{})[t]?.schema || "thresholds";
}

// ----------- Tab switcher -----------
function switchTab(name) {
  cfgTab = name;
  $$(".cfg-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $("#cfgPaneSetpoints").classList.toggle("hidden", name !== "setpoints");
  $("#cfgPaneGroups").classList.toggle("hidden",   name !== "groups");
  $("#cfgPaneAudit").classList.toggle("hidden",    name !== "audit");
  if (name === "setpoints") renderList();
  if (name === "groups")    renderGroups();
  if (name === "audit")     renderAuditList();
}

// ===================================================================
// SET POINTS LIST + TABLE
// ===================================================================
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
    <div>Hard / Soft Range</div>
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
        <div class="range-line"><span class="band-tag hard">hard</span> ${sp.hardMin} – ${sp.hardMax} ${sp.unit}</div>
        <div class="range-line"><span class="band-tag soft">soft</span> ${sp.softMin} – ${sp.softMax} ${sp.unit}</div>
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

// ===================================================================
// MODAL — dynamic form by schema
// ===================================================================
function openSpModal(spId, defaults = {}) {
  editingSpId = spId;
  const sp = spId ? (window.SETPOINTS||[]).find(x => x.id === spId) : null;
  $("#spModalTitle").textContent = sp ? "Edit set point" : "Add set point";
  $("#mType").value = sp?.type || defaults.type || "Level";
  $("#mName").value = sp?.name || defaults.name || "";
  $("#mHmiTag").value = sp?.hmiTag || defaults.hmiTag || "";
  $("#mActive").checked = sp ? !!sp.active : true;

  renderSchemaFields(sp || defaults);
  renderEquipmentChips(sp?.targets || defaults.targets || []);
  renderHistorySection(sp);
  updateUnitLabels();
  $("#spModal").classList.remove("hidden");
}

function closeSpModal() {
  editingSpId = null;
  $("#spModal").classList.add("hidden");
}

function updateUnitLabels() {
  const t = $("#mType").value;
  const u = (window.SP_TYPE_DEFAULTS||{})[t]?.unit || "";
  $$(".m-unit-suffix").forEach(el => el.textContent = u || "—");
  const disp = $("#mUnitDisplay");
  if (disp) disp.innerHTML = u ? `<b>${u}</b><span class="ud-sub">${typeBlurb(t)}</span>` : "—";
}

// ===================================================================
// Schema-driven field renderer
// ===================================================================
function renderSchemaFields(sp) {
  const host = $("#mSchemaFields");
  if (!host) return;
  const schema = currentTypeSchema();
  host.innerHTML = "";
  if (schema === "lt") {
    host.appendChild(buildLtFields(sp));
  } else if (schema === "pt") {
    host.appendChild(buildPtFields(sp));
  } else if (schema === "switchover") {
    // Switchover handled separately on Groups tab
    host.innerHTML = `<div class="cfg-info-inline">Switchover Time is configured on the <a href="#" id="goGroups">Groups</a> tab. It applies to a duty/standby group, not a single set point.</div>`;
    setTimeout(() => $("#goGroups")?.addEventListener("click", e => { e.preventDefault(); closeSpModal(); switchTab("groups"); }), 0);
  } else {
    host.appendChild(buildThresholdFields(sp));
  }
}

// Threshold schema — hard min / soft min / soft max / hard max
function buildThresholdFields(sp) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="cfg-section-label">
      <span>Allowed range &amp; soft warning band</span>
      <span class="cfg-help">Hard limits cap the operator. Soft band triggers a warning.</span>
    </div>
    <div class="cfg-grid-4">
      <div class="cfg-field"><label>Hard Min</label><div class="cfg-input"><input type="number" step="any" id="fldHardMin" value="${sp?.hardMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      <div class="cfg-field"><label>Soft Min</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMin" value="${sp?.softMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      <div class="cfg-field"><label>Soft Max</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMax" value="${sp?.softMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      <div class="cfg-field"><label>Hard Max</label><div class="cfg-input"><input type="number" step="any" id="fldHardMax" value="${sp?.hardMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
    </div>
    <div class="cfg-bandpreview" id="bandPreview"></div>
  `;
  setTimeout(() => {
    ["fldHardMin","fldSoftMin","fldSoftMax","fldHardMax"].forEach(id => $("#"+id)?.addEventListener("input", renderBandPreview));
    renderBandPreview();
  }, 0);
  return wrap;
}

// PT schema — Max mandatory, Min optional
function buildPtFields(sp) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="cfg-section-label">
      <span>Pressure thresholds</span>
      <span class="cfg-help">Maximum is required; minimum is optional per plant.</span>
    </div>
    <div class="cfg-grid-2">
      <div class="cfg-field">
        <label>Max Pressure <span class="req">required</span></label>
        <div class="cfg-input"><input type="number" step="any" id="fldHardMax" value="${sp?.hardMax ?? ""}"><span class="unit m-unit-suffix">—</span></div>
      </div>
      <div class="cfg-field">
        <label>Min Pressure (optional)</label>
        <div class="cfg-input"><input type="number" step="any" id="fldHardMin" value="${sp?.hardMin ?? ""}"><span class="unit m-unit-suffix">—</span></div>
      </div>
    </div>
    <div class="cfg-grid-2">
      <div class="cfg-field"><label>Soft Min (warn)</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMin" value="${sp?.softMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      <div class="cfg-field"><label>Soft Max (warn)</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMax" value="${sp?.softMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
    </div>
    <div class="cfg-bandpreview" id="bandPreview"></div>
  `;
  setTimeout(() => {
    ["fldHardMin","fldSoftMin","fldSoftMax","fldHardMax"].forEach(id => $("#"+id)?.addEventListener("input", renderBandPreview));
    renderBandPreview();
  }, 0);
  return wrap;
}

// LT schema — Intake Min/Max + Outlet Min/Max for transfer pumps
function buildLtFields(sp) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="cfg-section-label">
      <span>Transfer pump tank levels</span>
      <span class="cfg-help">Both intake and outlet ranges required.</span>
    </div>
    <div class="cfg-lt-block">
      <div class="cfg-lt-title">Intake Tank</div>
      <div class="cfg-grid-2">
        <div class="cfg-field"><label>Min Intake Level</label><div class="cfg-input"><input type="number" step="any" id="fldHardMin" value="${sp?.hardMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
        <div class="cfg-field"><label>Max Intake Level</label><div class="cfg-input"><input type="number" step="any" id="fldHardMax" value="${sp?.hardMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      </div>
    </div>
    <div class="cfg-lt-block">
      <div class="cfg-lt-title">Outlet Tank</div>
      <div class="cfg-grid-2">
        <div class="cfg-field"><label>Min Outlet Level</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMin" value="${sp?.softMin ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
        <div class="cfg-field"><label>Max Outlet Level</label><div class="cfg-input"><input type="number" step="any" id="fldSoftMax" value="${sp?.softMax ?? ""}"><span class="unit m-unit-suffix">—</span></div></div>
      </div>
    </div>
  `;
  return wrap;
}

function renderBandPreview() {
  const host = $("#bandPreview"); if (!host) return;
  const hMin = parseFloat($("#fldHardMin")?.value);
  const sMin = parseFloat($("#fldSoftMin")?.value);
  const sMax = parseFloat($("#fldSoftMax")?.value);
  const hMax = parseFloat($("#fldHardMax")?.value);
  if ([hMin, sMin, sMax, hMax].some(v => isNaN(v)) || hMax <= hMin) {
    host.innerHTML = `<div class="band-hint">Enter all four values to preview the warning band.</div>`;
    return;
  }
  const span = hMax - hMin;
  const sMinPct = ((sMin - hMin) / span) * 100;
  const sMaxPct = ((sMax - hMin) / span) * 100;
  const unit = (window.SP_TYPE_DEFAULTS||{})[$("#mType").value]?.unit || "";
  host.innerHTML = `
    <div class="band-bar">
      <div class="band-seg hard-low"  style="left:0;width:${sMinPct}%"></div>
      <div class="band-seg safe"      style="left:${sMinPct}%;width:${sMaxPct-sMinPct}%"></div>
      <div class="band-seg hard-high" style="left:${sMaxPct}%;width:${100-sMaxPct}%"></div>
    </div>
    <div class="band-labels">
      <span>${hMin}${unit}<small>hard min</small></span>
      <span>${sMin}${unit}<small>soft min</small></span>
      <span>${sMax}${unit}<small>soft max</small></span>
      <span>${hMax}${unit}<small>hard max</small></span>
    </div>
  `;
}

// ===================================================================
// Multi-select dropdown
// ===================================================================
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
  if (!text) return;
  if (!msSelected.size) {
    text.innerHTML = `<span class="ms-placeholder">Select equipment…</span>`;
  } else {
    const names = EQUIPMENT_CATALOG.filter(e => msSelected.has(e.id)).map(e => e.name);
    const visible = names.slice(0, 2);
    const extra = names.length - visible.length;
    text.innerHTML = visible.map(n => `<span class="ms-chip">${n}</span>`).join("") +
                     (extra > 0 ? `<span class="ms-chip more">+${extra} more</span>` : "");
  }
  if ($("#mEqCount")) $("#mEqCount").textContent = `${msSelected.size} selected`;
}
function renderMsList() {
  const list = $("#msMenuList"); if (!list) return;
  list.innerHTML = "";
  const items = EQUIPMENT_CATALOG.filter(eq => !msMenuSearch || eq.name.toLowerCase().includes(msMenuSearch));
  if (!items.length) {
    list.innerHTML = `<div class="ms-empty">No equipment matches "${msMenuSearch}"</div>`;
    return;
  }
  for (const eq of items) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ms-item" + (msSelected.has(eq.id) ? " selected" : "");
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
function toggleMsMenu() {
  const menu = $("#msMenu");
  const trig = $("#msTrigger");
  const open = !menu.classList.contains("hidden");
  if (open) { menu.classList.add("hidden"); trig.setAttribute("aria-expanded", "false"); }
  else      { menu.classList.remove("hidden"); trig.setAttribute("aria-expanded", "true"); $("#msMenuSearch")?.focus(); }
}

// ===================================================================
// History rendering inside modal
// ===================================================================
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

// ===================================================================
// Save
// ===================================================================
function saveSpFromModal() {
  const type = $("#mType").value;
  const name = $("#mName").value.trim();
  const hmiTag = $("#mHmiTag").value.trim();
  const hardMin = parseFloat($("#fldHardMin")?.value);
  const softMin = parseFloat($("#fldSoftMin")?.value);
  const softMax = parseFloat($("#fldSoftMax")?.value);
  const hardMax = parseFloat($("#fldHardMax")?.value);
  const active = $("#mActive").checked;
  const targets = Array.from(msSelected);
  const schema = currentTypeSchema();

  if (!name)   return toast("Name is required", "bad");
  if (!hmiTag) return toast("HMI Set Point Tag is required", "bad");
  if (!targets.length) return toast("Link at least one equipment", "bad");

  if (schema === "switchover") { toast("Switchover Time is configured on the Groups tab", "warn"); return; }
  if (schema === "pt") {
    if (isNaN(hardMax)) return toast("Max pressure is required", "bad");
  } else {
    if ([hardMin,softMin,softMax,hardMax].some(isNaN)) return toast("All four thresholds must be numbers", "bad");
    if (hardMax <= hardMin) return toast("Hard Max must be greater than Hard Min", "bad");
    if (softMin < hardMin || softMax > hardMax) return toast("Soft band must lie within hard limits", "bad");
    if (softMax <= softMin) return toast("Soft Max must be greater than Soft Min", "bad");
  }

  const unit = (window.SP_TYPE_DEFAULTS||{})[type]?.unit || "";
  const list = window.SETPOINTS || (window.SETPOINTS = []);

  if (editingSpId) {
    const sp = list.find(x => x.id === editingSpId);
    if (sp) {
      const changes = {};
      if (sp.hardMin !== hardMin) changes.hardMin = { from: sp.hardMin, to: hardMin };
      if (sp.softMin !== softMin) changes.softMin = { from: sp.softMin, to: softMin };
      if (sp.softMax !== softMax) changes.softMax = { from: sp.softMax, to: softMax };
      if (sp.hardMax !== hardMax) changes.hardMax = { from: sp.hardMax, to: hardMax };
      if (sp.active !== active)   changes.active  = { from: sp.active,  to: active  };
      if (Object.keys(changes).length) {
        sp.history = sp.history || [];
        sp.history.push({ ts: new Date().toISOString(), kind: "config", changes, who: "you" });
      }
      Object.assign(sp, { type, name, hmiTag, hardMin, softMin, softMax, hardMax, unit, active, targets });
      if (sp.current < hardMin) sp.current = hardMin;
      if (sp.current > hardMax) sp.current = hardMax;
      sp.source = `Configured · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
      window.audit?.({ kind:"setpoint-config", target:sp.id, detail:sp.hmiTag, changes });
      toast(`Updated: ${name}`, "ok");
    }
  } else {
    const id = "sp-" + Date.now().toString(36);
    const created = {
      id, type, name, hmiTag, hardMin, softMin, softMax, hardMax, unit, active, targets,
      equipment: targets.length ? "Linked equipment" : "Unassigned",
      current: (hardMin + hardMax) / 2,
      liveValue: (hardMin + hardMax) / 2,
      source: "Created · " + new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"}),
      history: [{ ts: new Date().toISOString(), kind: "config", changes: { created: { from: "—", to: "—" } }, who: "you", note: "Created" }],
    };
    list.push(created);
    window.audit?.({ kind:"setpoint-create", target:id, detail:hmiTag });
    toast(`Added: ${name}`, "ok");
  }

  closeSpModal();
  renderList();
}

// ===================================================================
// GROUPS (Switchover Time)
// ===================================================================
function renderGroups() {
  const host = $("#groupsList"); if (!host) return;
  host.innerHTML = "";
  for (const g of (window.SP_GROUPS||[])) {
    const card = document.createElement("div");
    card.className = "grp-card";
    const memberNames = g.members.map(id => EQUIPMENT_CATALOG.find(e=>e.id===id)?.name || id);
    card.innerHTML = `
      <div class="grp-card-head">
        <div>
          <div class="grp-card-title">${g.name}</div>
          <div class="grp-card-sub">${g.members.length} members · duty/standby alternation</div>
          <code class="sp-hmi-tag" style="margin-top:6px">${g.hmiTag||"—"}</code>
        </div>
        <button class="dp-btn ghost sm grp-edit">Edit</button>
      </div>
      <div class="grp-members">
        ${memberNames.map(n=>`<span class="ms-chip">${n}</span>`).join("")}
      </div>
      <div class="grp-switch">
        <div class="grp-switch-lbl">Switchover Time</div>
        <div class="grp-switch-val">${g.switchoverTime} <span class="unit">${g.unit}</span></div>
      </div>
    `;
    card.querySelector(".grp-edit").addEventListener("click", () => openGroupModal(g.id));
    host.appendChild(card);
  }
}

function openGroupModal(grpId) {
  editingGroupId = grpId;
  const g = (window.SP_GROUPS||[]).find(x => x.id === grpId);
  if (!g) return;
  $("#grpModalTitle").textContent = `Edit · ${g.name}`;
  $("#grpFldName").value = g.name;
  $("#grpFldTime").value = g.switchoverTime;
  $("#grpFldHmi").value = g.hmiTag || "";
  const list = $("#grpMembersList");
  list.innerHTML = "";
  for (const eq of EQUIPMENT_CATALOG) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ms-item" + (g.members.includes(eq.id) ? " selected" : "");
    item.dataset.id = eq.id;
    item.innerHTML = `
      <span class="ms-check">${g.members.includes(eq.id) ? '<svg width="11" height="11" viewBox="0 0 14 14"><path d="M2,7 L5.5,10.5 L12,3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
      <span class="ms-name">${eq.name}</span>
    `;
    item.addEventListener("click", () => {
      item.classList.toggle("selected");
      const cb = item.querySelector(".ms-check");
      cb.innerHTML = item.classList.contains("selected")
        ? '<svg width="11" height="11" viewBox="0 0 14 14"><path d="M2,7 L5.5,10.5 L12,3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : "";
    });
    list.appendChild(item);
  }
  $("#grpModal").classList.remove("hidden");
}
function closeGroupModal() { $("#grpModal").classList.add("hidden"); editingGroupId = null; }
function saveGroupModal() {
  if (!editingGroupId) return;
  const g = (window.SP_GROUPS||[]).find(x => x.id === editingGroupId);
  if (!g) return;
  const name = $("#grpFldName").value.trim();
  const time = parseFloat($("#grpFldTime").value);
  const hmi  = $("#grpFldHmi").value.trim();
  const members = Array.from($("#grpMembersList").querySelectorAll(".ms-item.selected")).map(b => b.dataset.id);
  if (!name) return toast("Name is required", "bad");
  if (isNaN(time) || time <= 0) return toast("Switchover time must be a positive number", "bad");
  if (!members.length) return toast("Pick at least one member", "bad");
  const before = { switchoverTime: g.switchoverTime, memberCount: g.members.length };
  g.name = name; g.switchoverTime = time; g.hmiTag = hmi; g.members = members;
  window.audit?.({ kind:"group-config", target:g.id, detail:`Switchover ${before.switchoverTime}→${time}${g.unit}`, from:before.switchoverTime, to:time });
  toast(`Updated: ${name}`, "ok");
  closeGroupModal();
  renderGroups();
}

// ===================================================================
// AUDIT LOG
// ===================================================================
function renderAuditList() {
  const host = $("#auditList"); if (!host) return;
  const entries = (window.AUDIT_LOG || []).slice().sort((a,b) => new Date(b.ts) - new Date(a.ts));
  if (!entries.length) {
    host.innerHTML = `<div class="cfg-empty-row">No audit entries yet.</div>`;
    return;
  }
  host.innerHTML = `
    <div class="audit-row audit-head">
      <div>Time</div><div>User</div><div>Kind</div><div>Target</div><div>Detail</div>
    </div>
  `;
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "audit-row";
    const when = new Date(e.ts).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
    const kindLabel = ({
      "setpoint-value": "Set point change",
      "setpoint-config": "Set point config",
      "setpoint-create": "Set point created",
      "remote-engage": "Remote engaged",
      "remote-release": "Remote released",
      "command-override": "Command override",
      "plc-write-fail": "PLC write failed",
      "group-config": "Group config",
    })[e.kind] || e.kind;
    const detail = e.from !== undefined && e.to !== undefined
      ? `<code>${e.detail || ""}</code> · <b>${e.from}</b> → <b>${e.to}</b>`
      : (e.detail || "—");
    row.innerHTML = `
      <div class="audit-ts">${when}</div>
      <div class="audit-user">${e.who}</div>
      <div class="audit-kind"><span class="audit-kind-pill k-${e.kind.split('-')[0]}">${kindLabel}</span></div>
      <div class="audit-target"><code>${e.target||"—"}</code></div>
      <div class="audit-detail">${detail}${e.note?` <i>${e.note}</i>`:""}</div>
    `;
    host.appendChild(row);
  }
}

// ===================================================================
// Init
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  $$(".cfg-tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // Set-points tab wiring
  $("#cfgSearch")?.addEventListener("input", renderList);
  $("#cfgFilter")?.addEventListener("change", renderList);
  $("#addSpBtn")?.addEventListener("click", () => openSpModal(null));
  $("#spModalClose")?.addEventListener("click", closeSpModal);
  $("#spModalCancel")?.addEventListener("click", closeSpModal);
  $("#spModalSave")?.addEventListener("click", saveSpFromModal);
  $("#mType")?.addEventListener("change", () => { renderSchemaFields(null); updateUnitLabels(); });

  // Multi-select dropdown
  $("#msTrigger")?.addEventListener("click", e => { e.stopPropagation(); toggleMsMenu(); });
  $("#msMenuSearch")?.addEventListener("input", e => { msMenuSearch = e.target.value.toLowerCase(); renderMsList(); });
  $("#msSelectAll")?.addEventListener("click", () => { EQUIPMENT_CATALOG.forEach(eq => msSelected.add(eq.id)); renderMsTrigger(); renderMsList(); });
  $("#msClearAll")?.addEventListener("click", () => { msSelected.clear(); renderMsTrigger(); renderMsList(); });
  document.addEventListener("click", e => {
    if (!e.target.closest("#msEquipment")) { $("#msMenu")?.classList.add("hidden"); $("#msTrigger")?.setAttribute("aria-expanded","false"); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSpModal(); closeGroupModal(); $("#msMenu")?.classList.add("hidden"); } });

  // Groups tab wiring
  $("#grpModalClose")?.addEventListener("click", closeGroupModal);
  $("#grpModalCancel")?.addEventListener("click", closeGroupModal);
  $("#grpModalSave")?.addEventListener("click", saveGroupModal);

  // Initial
  switchTab("setpoints");
  // Deep-link: ?sp=ID opens that set point's edit modal
  const params = new URLSearchParams(window.location.search);
  const spId = params.get("sp");
  if (spId) {
    setTimeout(() => openSpModal(spId), 100);
  }
});
