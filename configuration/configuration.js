// =====================================================================
// Set-Point Parent Configuration — minimal: enable + threshold (min/max)
// =====================================================================

let currentSpId = null;

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
    el.innerHTML = `
      <div class="ic">${sp.type.slice(0,3).toUpperCase()}</div>
      <div>
        <div class="name">${sp.name}</div>
        <div class="sub">${sp.equipment}</div>
        <div class="meta">
          <span class="tag">${sp.type}</span>
          <span class="tag ${sp.active?'on':'off'}">${sp.active?'ENABLED':'DISABLED'}</span>
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
        </div>
      </div>
    </div>

    <div class="cfg-section">
      <div class="cfg-row" style="border:0;padding:4px 0">
        <div class="lbl">
          Enable this set point
          <small>When disabled, the PLC uses its built-in logic and operator overrides are ignored.</small>
        </div>
        <label class="switch big"><input type="checkbox" id="fldActive" ${sp.active?'checked':''}><span class="slider"></span></label>
      </div>
    </div>

    <div class="cfg-section">
      <div class="cfg-section-head">
        <div class="cfg-section-title">THRESHOLD</div>
        <span class="muted" style="font-size:11px">Unit: <b style="color:var(--text)">${sp.unit}</b></span>
      </div>
      <div class="cfg-row">
        <div class="lbl">Minimum allowed
          <small>Hard floor — operators cannot set a value below this.</small>
        </div>
        <div class="cfg-input"><input type="number" step="any" id="fldMin" value="${sp.min}"><span class="unit">${sp.unit}</span></div>
      </div>
      <div class="cfg-row">
        <div class="lbl">Maximum allowed
          <small>Hard ceiling — operators cannot set a value above this.</small>
        </div>
        <div class="cfg-input"><input type="number" step="any" id="fldMax" value="${sp.max}"><span class="unit">${sp.unit}</span></div>
      </div>
    </div>

    <div class="cfg-footer">
      <div class="info">
        Defines the <b>allowed override range</b>. Operators set the actual value from the plant view.
      </div>
      <div style="display:flex;gap:8px">
        <button class="dp-btn ghost" id="discardChanges">Discard</button>
        <button class="dp-btn primary" id="saveChanges">Save</button>
      </div>
    </div>
  `;

  $("#saveChanges").addEventListener("click", () => saveConfiguration(sp.id));
  $("#discardChanges").addEventListener("click", () => selectSp(sp.id));
}

function saveConfiguration(spId) {
  const sp = (window.SETPOINTS||[]).find(x => x.id === spId); if (!sp) return;
  const newActive = $("#fldActive").checked;
  const newMin = parseFloat($("#fldMin").value);
  const newMax = parseFloat($("#fldMax").value);

  if ([newMin, newMax].some(isNaN)) { toast("Min and Max must be valid numbers", "bad"); return; }
  if (newMax <= newMin) { toast("Max must be greater than Min", "bad"); return; }

  sp.active = newActive;
  sp.min = newMin;
  sp.max = newMax;
  // Keep safe range inside new bounds (clamp)
  if (sp.safeMin < sp.min) sp.safeMin = sp.min;
  if (sp.safeMax > sp.max) sp.safeMax = sp.max;
  if (sp.safeMin >= sp.safeMax) { sp.safeMin = sp.min; sp.safeMax = sp.max; }
  if (sp.current < sp.min) sp.current = sp.min;
  if (sp.current > sp.max) sp.current = sp.max;
  sp.source = `Parent config · ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}`;

  toast(`Saved · ${sp.name} ${newActive?'enabled':'disabled'} · range ${newMin}–${newMax} ${sp.unit}`, "ok");
  renderList();
  renderEditor(sp);
}

document.addEventListener("DOMContentLoaded", () => {
  renderList();
  $("#cfgSearch")?.addEventListener("input", renderList);
  $("#cfgFilter")?.addEventListener("change", renderList);
});
