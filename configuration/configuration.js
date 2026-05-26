// =====================================================================
// Set-Point Parent Configuration page
// =====================================================================

// Equipment registry (minimal, from main app) — used for the link picker
const EQUIPMENT_CATALOG = [
  { id:"SBR1_INLET", name:"SBR 1 Inlet Valve", type:"VALVE" },
  { id:"SBR2_INLET", name:"SBR 2 Inlet Valve", type:"VALVE" },
  { id:"AIR1", name:"SBR 1 Air Inlet Line", type:"VALVE" },
  { id:"AIR2", name:"SBR 2 Air Inlet Line", type:"VALVE" },
  { id:"BLOWER1", name:"SBR Blower 1", type:"BLOWER" },
  { id:"BLOWER2", name:"SBR Blower 2", type:"BLOWER" },
  { id:"BLOWER3", name:"SBR Blower 3", type:"BLOWER" },
  { id:"BLOWER4", name:"SBR Blower 4", type:"BLOWER" },
  { id:"DECANTER", name:"SBR Decanter", type:"DECANTER" },
  { id:"RECIRC_A1", name:"Re-Circulation Pump A1", type:"PUMP" },
  { id:"RECIRC_A2", name:"Re-Circulation Pump A2", type:"PUMP" },
  { id:"SLUDGE_A1", name:"Sludge Sump Pump A1", type:"PUMP" },
  { id:"SLUDGE_A2", name:"Sludge Sump Pump A2", type:"PUMP" },
  { id:"RECIRC_B1", name:"Re-Circulation Pump B1", type:"PUMP" },
  { id:"RECIRC_B2", name:"Re-Circulation Pump B2", type:"PUMP" },
  { id:"SLUDGE_B1", name:"Sludge Sump Pump B1", type:"PUMP" },
  { id:"SLUDGE_B2", name:"Sludge Sump Pump B2", type:"PUMP" },
];

const SP_TYPE_META = {
  "Level":                            { unit:"%", behaviour:"Triggers ON/OFF of linked equipment based on threshold crossing." },
  "DO":                               { unit:"ppm", behaviour:"Modulates ON/OFF and VFD output (RPM, Hz, current) of blowers." },
  "Differential Pressure":            { unit:"bar", behaviour:"Triggers backwash valve sequence (ON/OFF) when ΔP exceeds threshold." },
  "Differential Pressure (calculated)":{ unit:"bar", behaviour:"Same as ΔP but using calculated TMP. Triggers backwash valve sequence." },
  "pH":                               { unit:"pH", behaviour:"Triggers dosing pump ON/OFF (NaOH / HCl) to correct pH." },
  "FRC":                              { unit:"ppm", behaviour:"Triggers NaOCl dosing pump ON/OFF to maintain chlorine residual." },
  "ORP":                              { unit:"mV", behaviour:"Triggers ORP-correction dosing pump ON/OFF." },
  "Flow":                             { unit:"m³/hr", behaviour:"Changes VFD output (RPM, Hz, current) of linked pumps. Does NOT toggle ON/OFF." },
  "Time":                             { unit:"s", behaviour:"Sets a fixed duration in a sequence (e.g. backwash, decant)." },
};

let currentSpId = null;
let pendingChanges = null;

function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }
let toastT;
function toast(msg, kind="") {
  const t = $("#toast"); t.className = "toast " + kind; t.textContent = msg;
  t.classList.remove("hidden"); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}

function renderList() {
  const list = $("#cfgList"); if (!list) return;
  list.innerHTML = "";
  const search = ($("#cfgSearch")?.value || "").toLowerCase();
  const tFilter = $("#cfgFilter")?.value || "";
  const sps = (window.SETPOINTS||[]).filter(sp => {
    if (tFilter && sp.type !== tFilter) return false;
    if (search && !(sp.name.toLowerCase().includes(search) || sp.equipment.toLowerCase().includes(search) || sp.type.toLowerCase().includes(search))) return false;
    return true;
  });
  for (const sp of sps) {
    const el = document.createElement("div");
    el.className = "cfg-list-item" + (sp.id === currentSpId ? " active" : "");
    el.dataset.id = sp.id;
    const ic = sp.type.slice(0,3).toUpperCase();
    el.innerHTML = `
      <div class="ic">${ic}</div>
      <div>
        <div class="name">${sp.name}</div>
        <div class="sub">${sp.equipment}</div>
        <div class="meta">
          <span class="tag">${sp.type}</span>
          <span class="tag ${sp.active?'on':'off'}">${sp.active?'ACTIVE':'INACTIVE'}</span>
        </div>
      </div>
      <div class="chev">›</div>
    `;
    el.addEventListener("click", () => selectSp(sp.id));
    list.appendChild(el);
  }
}

function selectSp(id) {
  currentSpId = id;
  pendingChanges = null;
  renderList();
  const sp = (window.SETPOINTS||[]).find(x => x.id === id);
  if (!sp) return;
  renderEditor(sp);
}

function renderEditor(sp) {
  const editor = $("#cfgEditor"); if (!editor) return;
  editor.innerHTML = `
    <div class="cfg-editor-head">
      <div class="left">
        <div class="ic-big">${sp.type.slice(0,3).toUpperCase()}</div>
        <div>
          <h2>${sp.name}</h2>
          <div class="sub">${sp.equipment} · ${sp.type} set point</div>
          <div class="sub" style="font-size:11px;margin-top:2px"><b>Source:</b> ${sp.source}</div>
        </div>
      </div>
      <div class="head-actions">
        <button class="big-toggle ${sp.active?'active':''}" id="toggleActive">
          <span class="label">${sp.active?'ACTIVATED':'INACTIVE'}</span>
          <label class="switch"><input type="checkbox" ${sp.active?'checked':''}><span class="slider"></span></label>
        </button>
      </div>
    </div>

    <!-- META -->
    <div class="cfg-section">
      <div class="cfg-section-head">
        <div class="cfg-section-title">METADATA</div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Name<small>Operator-facing label for this set point.</small></div>
        <div class="cfg-text" style="width:280px"><input type="text" id="fldName" value="${sp.name}"></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Set point type<small>Choosing a type sets the default unit & behaviour.</small></div>
        <div>
          <select id="fldType" style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:#fff;font-size:13px">
            ${Object.keys(SP_TYPE_META).map(t => `<option ${t===sp.type?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Description<small>Shown in the equipment drawer when an operator edits.</small></div>
        <div class="cfg-text" style="width:280px"><textarea id="fldDesc" rows="2">${sp.description||""}</textarea></div>
      </div>
    </div>

    <!-- THRESHOLD -->
    <div class="cfg-section">
      <div class="cfg-section-head">
        <div class="cfg-section-title">THRESHOLD & SAFE RANGE</div>
        <span class="muted" style="font-size:11px">Unit: <b style="color:var(--text)">${sp.unit}</b></span>
      </div>
      <div class="cfg-range">
        <div class="cfg-range-bar" id="rangeBarPreview">
          <div class="safe"></div>
          <div class="marker"></div>
        </div>
        <div class="cfg-range-labels">
          <div class="col"><div class="k">MIN</div><div class="v" id="rngMinPreview">${sp.min}</div></div>
          <div class="col"><div class="k">SAFE MIN</div><div class="v" id="rngSafeMinPreview">${sp.safeMin}</div></div>
          <div class="col"><div class="k">SAFE MAX</div><div class="v" id="rngSafeMaxPreview">${sp.safeMax}</div></div>
          <div class="col"><div class="k">MAX</div><div class="v" id="rngMaxPreview">${sp.max}</div></div>
        </div>
      </div>

      <div class="cfg-row" style="margin-top:12px">
        <div class="lbl">Minimum allowed<small>Hard floor — operator cannot set value below this.</small></div>
        <div class="cfg-input"><input type="number" step="any" id="fldMin" value="${sp.min}"><span class="unit">${sp.unit}</span></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Safe range minimum<small>Below this triggers an out-of-safe-range warning.</small></div>
        <div class="cfg-input"><input type="number" step="any" id="fldSafeMin" value="${sp.safeMin}"><span class="unit">${sp.unit}</span></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Safe range maximum<small>Above this triggers an out-of-safe-range warning.</small></div>
        <div class="cfg-input"><input type="number" step="any" id="fldSafeMax" value="${sp.safeMax}"><span class="unit">${sp.unit}</span></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Maximum allowed<small>Hard ceiling — operator cannot set value above this.</small></div>
        <div class="cfg-input"><input type="number" step="any" id="fldMax" value="${sp.max}"><span class="unit">${sp.unit}</span></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Default (initial) value<small>Used when no operator override is in place.</small></div>
        <div class="cfg-input"><input type="number" step="any" id="fldDefault" value="${sp.default}"><span class="unit">${sp.unit}</span></div>
      </div>
    </div>

    <!-- LINKED EQUIPMENT -->
    <div class="cfg-section">
      <div class="cfg-section-head">
        <div class="cfg-section-title">LINKED EQUIPMENT</div>
        <span class="muted" style="font-size:11px"><span id="targetCount">${(sp.targets||[]).length}</span> selected</span>
      </div>
      <div class="cfg-row">
        <div class="lbl">Behaviour<small>How linked equipment reacts to this set point. (Read-only — defined by type & PLC logic.)</small></div>
        <div class="muted" style="font-size:12px;max-width:280px;text-align:right" id="behaviourText">${sp.behaviour}</div>
      </div>
      <div style="margin-top:10px">
        <div class="cfg-chip-row" id="equipChipRow"></div>
      </div>
    </div>

    <div class="cfg-footer">
      <div class="info">
        Changes here affect the <b>allowed range</b> and <b>linked equipment</b>. The numeric value is still overridden from the plant view.
      </div>
      <div style="display:flex;gap:8px">
        <button class="dp-btn ghost" id="discardChanges">Discard</button>
        <button class="dp-btn primary" id="saveChanges">Save configuration</button>
      </div>
    </div>
  `;

  // Equipment chips
  const chipRow = $("#equipChipRow");
  for (const eq of EQUIPMENT_CATALOG) {
    const chip = document.createElement("div");
    chip.className = "cfg-chip" + ((sp.targets||[]).includes(eq.id) ? " selected" : "");
    chip.dataset.id = eq.id;
    chip.textContent = eq.name;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
      $("#targetCount").textContent = chipRow.querySelectorAll(".cfg-chip.selected").length;
    });
    chipRow.appendChild(chip);
  }

  // Active toggle
  const activeWrap = $("#toggleActive");
  activeWrap.querySelector("input").addEventListener("change", e => {
    activeWrap.classList.toggle("active", e.target.checked);
    activeWrap.querySelector(".label").textContent = e.target.checked ? "ACTIVATED" : "INACTIVE";
  });

  // Type change — update behaviour text + unit
  $("#fldType").addEventListener("change", e => {
    const t = e.target.value;
    const meta = SP_TYPE_META[t];
    $("#behaviourText").textContent = meta.behaviour;
    document.querySelectorAll(".cfg-section .unit").forEach(u => u.textContent = meta.unit);
  });

  // Live range preview
  ["fldMin","fldMax","fldSafeMin","fldSafeMax"].forEach(id => {
    $("#"+id).addEventListener("input", updateRangePreview);
  });
  updateRangePreview();

  // Footer actions
  $("#saveChanges").addEventListener("click", () => promptSaveConfiguration(sp.id));
  $("#discardChanges").addEventListener("click", () => selectSp(sp.id));
}

function updateRangePreview() {
  const min = parseFloat($("#fldMin").value);
  const max = parseFloat($("#fldMax").value);
  const sMin = parseFloat($("#fldSafeMin").value);
  const sMax = parseFloat($("#fldSafeMax").value);
  if ([min,max,sMin,sMax].some(isNaN) || max<=min) return;
  const span = max - min;
  const safeL = ((sMin - min) / span) * 100;
  const safeW = ((sMax - sMin) / span) * 100;
  const bar = $("#rangeBarPreview");
  bar.querySelector(".safe").style.left = `${safeL}%`;
  bar.querySelector(".safe").style.width = `${safeW}%`;
  bar.querySelector(".marker").style.left = `${safeL + safeW/2}%`;
  $("#rngMinPreview").textContent = min;
  $("#rngMaxPreview").textContent = max;
  $("#rngSafeMinPreview").textContent = sMin;
  $("#rngSafeMaxPreview").textContent = sMax;
}

function promptSaveConfiguration(spId) {
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId); if (!sp) return;
  const newName = $("#fldName").value.trim();
  const newType = $("#fldType").value;
  const newDesc = $("#fldDesc").value.trim();
  const newMin = parseFloat($("#fldMin").value);
  const newMax = parseFloat($("#fldMax").value);
  const newSafeMin = parseFloat($("#fldSafeMin").value);
  const newSafeMax = parseFloat($("#fldSafeMax").value);
  const newDefault = parseFloat($("#fldDefault").value);
  const newActive  = $("#toggleActive input").checked;
  const newTargets = Array.from($$("#equipChipRow .cfg-chip.selected")).map(c => c.dataset.id);

  // Validation
  if (!newName) { toast("Name is required", "bad"); return; }
  if ([newMin,newMax,newSafeMin,newSafeMax,newDefault].some(isNaN)) { toast("Numeric fields must be valid numbers", "bad"); return; }
  if (newMax <= newMin)   { toast("Max must be greater than Min", "bad"); return; }
  if (newSafeMin < newMin || newSafeMax > newMax || newSafeMax <= newSafeMin) { toast("Safe range must lie inside Min/Max and be valid", "bad"); return; }
  if (newDefault < newMin || newDefault > newMax) { toast("Default value must lie within Min/Max", "bad"); return; }

  pendingChanges = { spId, newName, newType, newDesc, newMin, newMax, newSafeMin, newSafeMax, newDefault, newActive, newTargets };

  // Impact list
  const impact = $("#spImpactList");
  impact.innerHTML = `<div class="sp-impact-head">PARENT-LEVEL CHANGES</div>` +
    `<div class="sp-impact-row"><span class="arrow">→</span><span class="target">Allowed range</span><span class="effect">${newMin} – ${newMax} ${SP_TYPE_META[newType].unit} (safe ${newSafeMin}–${newSafeMax})</span></div>` +
    `<div class="sp-impact-row"><span class="arrow">→</span><span class="target">Default value</span><span class="effect">${newDefault} ${SP_TYPE_META[newType].unit}</span></div>` +
    `<div class="sp-impact-row"><span class="arrow">→</span><span class="target">Linked equipment</span><span class="effect">${newTargets.length} device${newTargets.length===1?'':'s'} (${newTargets.map(t => EQUIPMENT_CATALOG.find(e=>e.id===t)?.name||t).slice(0,3).join(", ")}${newTargets.length>3?" …":""})</span></div>` +
    `<div class="sp-impact-row"><span class="arrow">→</span><span class="target">State</span><span class="effect">${newActive?"Active — PLC honours overrides":"Inactive — PLC ignores overrides"}</span></div>`;

  $("#spNoticeBody").innerHTML = `Updating <b>${sp.name}</b> at the parent level will change which values operators can set and which equipment is driven by this set point. The PLC automation logic itself is unchanged.`;
  $("#spNotice").classList.remove("hidden");
}

function applyPendingConfiguration() {
  if (!pendingChanges) return;
  const sp = (window.SETPOINTS||[]).find(x => x.id === pendingChanges.spId); if (!sp) return;
  sp.name = pendingChanges.newName;
  sp.type = pendingChanges.newType;
  sp.description = pendingChanges.newDesc;
  sp.min = pendingChanges.newMin;
  sp.max = pendingChanges.newMax;
  sp.safeMin = pendingChanges.newSafeMin;
  sp.safeMax = pendingChanges.newSafeMax;
  sp.default = pendingChanges.newDefault;
  sp.active = pendingChanges.newActive;
  sp.targets = pendingChanges.newTargets;
  sp.unit = SP_TYPE_META[sp.type].unit;
  sp.behaviour = SP_TYPE_META[sp.type].behaviour;
  sp.source = `Parent config · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;
  // Clamp current value into new range if needed
  if (sp.current < sp.min) sp.current = sp.min;
  if (sp.current > sp.max) sp.current = sp.max;
  pendingChanges = null;
  $("#spNotice").classList.add("hidden");
  toast(`Configuration saved · ${sp.name}`, "ok");
  renderList();
  renderEditor(sp);
}

function newSetPoint() {
  const id = "sp-new-" + Date.now();
  const sp = {
    id, type:"Level", name:"New set point",
    equipment:"Unassigned", targets:[],
    unit:"%", current:50, default:50, min:0, max:100, safeMin:40, safeMax:60,
    description:"Configure this set point",
    behaviour: SP_TYPE_META["Level"].behaviour,
    active:false, source:"Created just now",
  };
  (window.SETPOINTS||[]).unshift(sp);
  renderList();
  selectSp(id);
  toast("New set point created · configure & activate", "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  renderList();
  $("#cfgSearch")?.addEventListener("input", renderList);
  $("#cfgFilter")?.addEventListener("change", renderList);
  $("#addSp")?.addEventListener("click", newSetPoint);
  $("#spNoticeCancel")?.addEventListener("click", () => { $("#spNotice").classList.add("hidden"); pendingChanges = null; });
  $("#spNoticeConfirm")?.addEventListener("click", applyPendingConfiguration);
});
