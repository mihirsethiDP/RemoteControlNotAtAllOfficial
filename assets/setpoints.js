// =====================================================================
// Set-points registry — Phase 2 schema
//   hardMin · softMin · softMax · hardMax (warning bands)
//   liveValue (mocked PLC reading, updated by polling sim)
//   history[] (audit trail per setpoint)
// =====================================================================

const _hist = (entries) => entries;
window.SETPOINTS = [
  { id:"sp-lvl-cass1", type:"Level", name:"CASS Basin 1 — high level cut-in",
    equipment:"CASS Basin 1", targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"LIT_201.LEVEL_HIGH_SP",
    unit:"%", current:70, liveValue:68,
    hardMin:50, softMin:60, softMax:80, hardMax:95,
    active:true, source:"PLC default",
    history: _hist([
      { ts:"2026-05-04T09:14:00Z", kind:"value", from:75, to:70, who:"op-mihir", note:"Rainy week — lower cut-in" },
      { ts:"2026-04-21T11:30:00Z", kind:"value", from:80, to:75, who:"op-anita" },
    ]) },

  { id:"sp-lvl-cass2", type:"Level", name:"CASS Basin 2 — high level cut-in",
    equipment:"CASS Basin 2", targets:["RECIRC_B1","RECIRC_B2"],
    hmiTag:"LIT_202.LEVEL_HIGH_SP",
    unit:"%", current:72, liveValue:71,
    hardMin:50, softMin:60, softMax:80, hardMax:95,
    active:true, source:"Operator override · 04 May" },

  { id:"sp-do-cass1", type:"DO", name:"Dissolved Oxygen — Zone-3 Basin 1",
    equipment:"CASS Basin 1 · Zone-3", targets:["BLOWER1","BLOWER2","AIR1"],
    hmiTag:"AIT_101.DO_SP",
    unit:"ppm", current:2.0, liveValue:2.1,
    hardMin:0.5, softMin:1.5, softMax:2.5, hardMax:4.0,
    active:true, source:"PLC default",
    history: _hist([
      { ts:"2026-05-22T14:02:00Z", kind:"value", from:1.8, to:2.0, who:"op-mihir", note:"Aeration tuned after MLSS bump" },
      { ts:"2026-05-10T07:45:00Z", kind:"value", from:2.2, to:1.8, who:"op-anita" },
    ]) },

  { id:"sp-do-cass2", type:"DO", name:"Dissolved Oxygen — Zone-3 Basin 2",
    equipment:"CASS Basin 2 · Zone-3", targets:["BLOWER3","BLOWER4","AIR2"],
    hmiTag:"AIT_102.DO_SP",
    unit:"ppm", current:1.8, liveValue:1.9,
    hardMin:0.5, softMin:1.5, softMax:2.5, hardMax:4.0,
    active:true, source:"Operator override · 22 Apr" },

  { id:"sp-dp-psf1", type:"Differential Pressure", name:"PSF-1 backwash trigger",
    equipment:"PSF-1", targets:["DECANTER"],
    hmiTag:"PIT_301.DP_BW_SP",
    unit:"bar", current:0.8, liveValue:0.65,
    hardMin:0.3, softMin:0.5, softMax:1.0, hardMax:1.5,
    active:true, source:"PLC default" },

  { id:"sp-dp-calc-uf1", type:"Differential Pressure (calculated)", name:"UF-1 calculated TMP trigger",
    equipment:"UF-1", targets:["DECANTER"],
    hmiTag:"UF_001.TMP_CALC_SP",
    unit:"bar", current:1.2, liveValue:1.1,
    hardMin:0.5, softMin:0.8, softMax:1.5, hardMax:2.0,
    active:false, source:"Disabled" },

  { id:"sp-ph-inlet", type:"pH", name:"Inlet pH dosing trigger",
    equipment:"Equalization Tank", targets:["DECANTER"],
    hmiTag:"AIT_401.PH_SP",
    unit:"pH", current:7.0, liveValue:7.1,
    hardMin:4.0, softMin:6.5, softMax:8.0, hardMax:10.0,
    active:true, source:"PLC default" },

  { id:"sp-frc-clr", type:"FRC", name:"Free Residual Chlorine — outlet",
    equipment:"Chlorine Contact Tank", targets:["DECANTER"],
    hmiTag:"AIT_501.FRC_SP",
    unit:"ppm", current:0.5, liveValue:0.45,
    hardMin:0.1, softMin:0.2, softMax:1.0, hardMax:2.0,
    active:true, source:"PLC default" },

  { id:"sp-orp-cass1", type:"ORP", name:"ORP target — Zone-2 Basin 1",
    equipment:"CASS Basin 1 · Zone-2", targets:["DECANTER"],
    hmiTag:"AIT_103.ORP_SP",
    unit:"mV", current:-100, liveValue:-95,
    hardMin:-300, softMin:-200, softMax:-50, hardMax:0,
    active:true, source:"PLC default" },

  { id:"sp-flow-feed", type:"Flow", name:"UF Feed Pump — flow target",
    equipment:"UF Feed Pump A", targets:["DECANTER"],
    hmiTag:"FIT_601.FLOW_SP",
    unit:"m³/hr", current:90, liveValue:88,
    hardMin:40, softMin:70, softMax:110, hardMax:140,
    active:true, source:"Operator override · 18 Apr" },

  { id:"sp-time-bw", type:"Time", name:"PSF-1 backwash duration",
    equipment:"PSF-1", targets:["DECANTER"],
    hmiTag:"PSF_001.BW_DUR_SP",
    unit:"s", current:180, liveValue:180,
    hardMin:60, softMin:120, softMax:300, hardMax:600,
    active:true, source:"PLC default" },

  { id:"sp-time-decant", type:"Time", name:"SBR Decant duration",
    equipment:"CASS Basin 1 & 2", targets:["DECANTER"],
    hmiTag:"SBR_001.DECANT_DUR_SP",
    unit:"min", current:45, liveValue:45,
    hardMin:20, softMin:30, softMax:60, hardMax:90,
    active:true, source:"PLC default" },
];

// =====================================================================
// Duty / Standby Groups — used for Switchover Time configuration
// =====================================================================
window.SP_GROUPS = [
  { id:"grp-sbr-blowers", name:"SBR Blowers", members:["BLOWER1","BLOWER2","BLOWER3","BLOWER4"],
    switchoverTime: 480, unit: "min", hmiTag: "BLW_GRP.SWITCHOVER_MIN" },
  { id:"grp-recirc-a",   name:"Re-Circulation A", members:["RECIRC_A1","RECIRC_A2"],
    switchoverTime: 240, unit: "min", hmiTag: "RECIRC_A.SWITCHOVER_MIN" },
  { id:"grp-recirc-b",   name:"Re-Circulation B", members:["RECIRC_B1","RECIRC_B2"],
    switchoverTime: 240, unit: "min", hmiTag: "RECIRC_B.SWITCHOVER_MIN" },
];

// =====================================================================
// Type schemas — drive the dynamic configuration form
// =====================================================================
window.SP_TYPE_DEFAULTS = {
  "Level":   { unit:"%",      schema:"thresholds" },
  "DO":      { unit:"ppm",    schema:"thresholds" },
  "Differential Pressure":            { unit:"bar", schema:"pt" },
  "Differential Pressure (calculated)": { unit:"bar", schema:"pt" },
  "pH":      { unit:"pH",     schema:"thresholds" },
  "FRC":     { unit:"ppm",    schema:"thresholds" },
  "ORP":     { unit:"mV",     schema:"thresholds" },
  "Flow":    { unit:"m³/hr",  schema:"thresholds" },
  "Time":    { unit:"s",      schema:"thresholds" },
  // Special schemas (handled directly from plant click, not in the type dropdown)
  "LT (Transfer Pump)":  { unit:"m", schema:"lt" },
  "Switchover Time":     { unit:"min", schema:"switchover" },
};

// =====================================================================
// Audit log + helper
// =====================================================================
window.AUDIT_LOG = [
  { ts:"2026-05-22T14:02:00Z", who:"op-mihir", kind:"setpoint-value",  target:"sp-do-cass1",  detail:"AIT_101.DO_SP", from:1.8, to:2.0 },
  { ts:"2026-05-21T08:11:00Z", who:"op-mihir", kind:"remote-engage",   target:"BLOWER1",      detail:"Remote control engaged · 15m timer" },
  { ts:"2026-05-21T08:26:00Z", who:"system",   kind:"remote-release",  target:"BLOWER1",      detail:"Auto-return to local on timer expiry" },
  { ts:"2026-05-10T07:45:00Z", who:"op-anita", kind:"setpoint-value",  target:"sp-do-cass1",  detail:"AIT_101.DO_SP", from:2.2, to:1.8 },
];

window.audit = function(entry) {
  window.AUDIT_LOG.unshift({ ts: new Date().toISOString(), who:"op-mihir", ...entry });
  // Notify any subscribers (audit drawer re-renders)
  if (typeof window.onAuditAdded === "function") window.onAuditAdded(entry);
};

// =====================================================================
// Soft/hard zone classifier — used by sliders and warning popups
// =====================================================================
window.classifyZone = function(value, sp) {
  if (value < sp.hardMin || value > sp.hardMax) return "outside";
  if (value < sp.softMin || value > sp.softMax) return "warn";
  return "safe";
};
