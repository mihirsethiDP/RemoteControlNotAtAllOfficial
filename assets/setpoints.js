// =====================================================================
// Set-points registry — only 5 types supported per Phase 2 spec:
//   DO · PT · LT (Transfer Pump) · Flow · Switchover Time
// =====================================================================

window.SP_TYPES = ["DO", "PT", "LT", "Flow", "Switchover Time"];

// Auto-generate an HMI tag from a unit process + type + index.
// The PLC team maps this synthetic tag to the real PLC tag in their layer.
window.generateHmiTag = function(upName, type, index) {
  const upSlug = (upName || "UP").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const tSlug  = String(type || "SP").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${upSlug}.${tSlug}_${String(index||1).padStart(2,"0")}_SP`;
};

// Mock notification recipients
window.NOTIFY_USERS = [
  { id:"op-mihir",   name:"Mihir (Operator)",  role:"section_supervisor" },
  { id:"op-anita",   name:"Anita (Operator)",  role:"section_supervisor" },
  { id:"admin-rahul",name:"Rahul (Admin)",     role:"plant_admin" },
  { id:"svc-team",   name:"Service Team",      role:"team" },
];
window.NOTIFY_CHANNELS = ["Email", "SMS", "In-app"];

// Unit processes — algo-fetched groups of equipment that perform one process.
// In real life this comes from a topology algorithm; here we seed manually.
window.UNIT_PROCESSES = [
  {
    id: "up-aeration",
    name: "Aeration",
    description: "Provides dissolved oxygen to biological treatment in CASS basins via blowers and air-inlet valves.",
    equipmentIds: ["BLOWER1", "BLOWER2", "BLOWER3", "BLOWER4", "AIR1", "AIR2"],
    setpointIds:  ["sp-do-cass1", "sp-do-cass2", "sp-pt-header", "sp-sw-blw"],
  },
  {
    id: "up-recirc",
    name: "Re-Circulation",
    description: "Re-circulates mixed liquor between basin zones to maintain biological activity.",
    equipmentIds: ["RECIRC_A1", "RECIRC_A2", "RECIRC_B1", "RECIRC_B2"],
    setpointIds:  ["sp-lt-uffeed"],
  },
  {
    id: "up-decant",
    name: "Decanting",
    description: "Removes treated effluent at the end of each SBR cycle.",
    equipmentIds: ["DECANTER", "SBR1_INLET", "SBR2_INLET"],
    setpointIds:  [],
  },
  {
    id: "up-permeate",
    name: "Permeate Transfer",
    description: "Transfers permeate from UF outlet to storage at controlled flow rate.",
    equipmentIds: ["SLUDGE_A1", "SLUDGE_A2"],
    setpointIds:  ["sp-flow-perm"],
  },
];

window.SP_TYPE_UNIT = {
  "DO":              "mg/L",
  "PT":              "bar",
  "LT":              "%",
  "Flow":            "m³/hr",
  "Switchover Time": "min",
};

const _hist = (entries) => entries;
window.SETPOINTS = [
  // DO — slider with Min/Max
  { id:"sp-do-cass1", type:"DO",
    name:"Dissolved Oxygen — Zone-3 Basin 1",
    equipment:"DO Sensor · CASS Basin 1",
    targets:["BLOWER1","BLOWER2"],
    hmiTag:"AIT_101.DO_SP",
    unit:"mg/L", current:2.0, min:0.5, max:4.0,
    active:true, source:"PLC default",
    history: _hist([
      { ts:"2026-05-22T14:02:00Z", kind:"value", from:1.8, to:2.0, who:"op-mihir", note:"Aeration tuned after MLSS bump" },
      { ts:"2026-05-10T07:45:00Z", kind:"value", from:2.2, to:1.8, who:"op-anita" },
    ]) },

  { id:"sp-do-cass2", type:"DO",
    name:"Dissolved Oxygen — Zone-3 Basin 2",
    equipment:"DO Sensor · CASS Basin 2",
    targets:["BLOWER3","BLOWER4"],
    hmiTag:"AIT_102.DO_SP",
    unit:"mg/L", current:1.8, min:0.5, max:4.0,
    active:true, source:"Operator override · 22 Apr" },

  // PT — Max required, Min optional
  { id:"sp-pt-header", type:"PT",
    name:"Aeration header pressure",
    equipment:"PT Sensor · Air Header",
    targets:["BLOWER1","BLOWER2","BLOWER3","BLOWER4"],
    hmiTag:"PIT_301.MAX_SP",
    unit:"bar", current:0.8, min:null, max:1.5,
    active:true, source:"PLC default" },

  // LT — 4 values, no single slider
  { id:"sp-lt-uffeed", type:"LT",
    name:"UF Feed transfer — operating range",
    equipment:"Transfer Pump · UF Feed",
    targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"LT_201.OP_RANGE",
    unit:"%",
    intakeMin: 20, intakeMax: 85,
    outletMin: 25, outletMax: 80,
    active:true, source:"PLC default",
    history: _hist([
      { ts:"2026-05-12T09:00:00Z", kind:"value",
        from:"intake 25–85%, outlet 30–78%",
        to:"intake 20–85%, outlet 25–80%",
        who:"op-mihir", note:"Raised intake floor to avoid cavitation" },
    ]) },

  // Flow — slider with Min/Max
  { id:"sp-flow-perm", type:"Flow",
    name:"Permeate flow target",
    equipment:"Permeate Pump A",
    targets:["DECANTER"],
    hmiTag:"FIT_601.FLOW_SP",
    unit:"m³/hr", current:90, min:40, max:140,
    active:true, source:"Operator override · 18 Apr" },

  // Switchover Time — single value, group-level
  { id:"sp-sw-blw", type:"Switchover Time",
    name:"SBR Blowers — duty/standby switchover",
    equipment:"Blower duty/standby group",
    targets:["BLOWER1","BLOWER2","BLOWER3","BLOWER4"],
    hmiTag:"BLW_GRP.SWITCH_MIN",
    unit:"min", current:480, min:60, max:1440,
    active:true, source:"PLC default" },
];
