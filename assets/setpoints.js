// =====================================================================
// Set-points registry — only 5 types supported per Phase 2 spec:
//   DO · PT · LT (Transfer Pump) · Flow · Switchover Time
// =====================================================================

window.SP_TYPES = ["DO", "PT", "LT", "Flow", "Switchover Time", "Custom"];

// Sensor catalogue — live PLC tags exposed as read-only widgets in dashboards
window.SENSORS = [
  { id:"sen-do-live-b1", name:"DO Live · Basin 1", tag:"AIT_101.LIVE", unit:"mg/L", value:2.1 },
  { id:"sen-do-live-b2", name:"DO Live · Basin 2", tag:"AIT_102.LIVE", unit:"mg/L", value:1.9 },
  { id:"sen-pt-header",  name:"Header Pressure",   tag:"PIT_301.LIVE", unit:"bar",  value:0.65 },
  { id:"sen-flow-perm",  name:"Permeate Flow",     tag:"FIT_601.LIVE", unit:"m³/hr", value:88 },
  { id:"sen-lvl-src",    name:"Source Tank Level", tag:"LIT_201.LIVE", unit:"%",    value:42 },
  { id:"sen-lvl-dst",    name:"Dest Tank Level",   tag:"LIT_202.LIVE", unit:"%",    value:58 },
];

// Layout schema versioning — Studio bumps version on Publish; clients show nudge
window.LAYOUT_VERSION = { version: 1, publishedAt: "2026-06-01T00:00:00Z" };

// Auto-generate an HMI tag from a unit process + type + index.
// The PLC team maps this synthetic tag to the real PLC tag in their layer.
window.generateHmiTag = function(upName, type, index, role) {
  const upSlug = (upName || "UP").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const tSlug  = String(type || "SP").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const rSlug  = role ? `_${String(role).toUpperCase()}` : "";
  return `${upSlug}.${tSlug}${rSlug}_${String(index||1).padStart(2,"0")}_SP`;
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
    layout: [
      { id:"w-aer-h1", type:"header", text:"Zone-3 monitoring", col:12 },
      { id:"w-aer-1",  type:"setpoint", spId:"sp-do-cass1", col:4 },
      { id:"w-aer-2",  type:"setpoint", spId:"sp-do-cass2", col:4 },
      { id:"w-aer-3",  type:"sensor",   sensorId:"sen-do-live-b1", col:4 },
      { id:"w-aer-4",  type:"setpoint", spId:"sp-pt-header", col:6 },
      { id:"w-aer-5",  type:"sensor",   sensorId:"sen-pt-header", col:6 },
      { id:"w-aer-d1", type:"divider", col:12 },
      { id:"w-aer-6",  type:"setpoint", spId:"sp-sw-blw", col:12 },
    ],
  },
  {
    id: "up-recirc",
    name: "Re-Circulation",
    description: "Re-circulates mixed liquor between basin zones to maintain biological activity.",
    equipmentIds: ["RECIRC_A1", "RECIRC_A2", "RECIRC_B1", "RECIRC_B2"],
    setpointIds:  ["sp-lt-src-min", "sp-lt-src-max", "sp-lt-dst-min", "sp-lt-dst-max"],
    layout: [
      { id:"w-rec-1", type:"setpoint", spId:"sp-lt-src-min", col:12, ltGroupId:"lt-uffeed" },
      { id:"w-rec-2", type:"sensor",   sensorId:"sen-lvl-src", col:6 },
      { id:"w-rec-3", type:"sensor",   sensorId:"sen-lvl-dst", col:6 },
    ],
  },
  {
    id: "up-decant",
    name: "Decanting",
    description: "Removes treated effluent at the end of each SBR cycle.",
    equipmentIds: ["DECANTER", "SBR1_INLET", "SBR2_INLET"],
    setpointIds:  [],
    layout: [
      { id:"w-dec-n1", type:"note", text:"No set points configured for this unit process yet.", col:12 },
    ],
  },
  {
    id: "up-permeate",
    name: "Permeate Transfer",
    description: "Transfers permeate from UF outlet to storage at controlled flow rate.",
    equipmentIds: ["SLUDGE_A1", "SLUDGE_A2"],
    setpointIds:  ["sp-flow-perm"],
    layout: [
      { id:"w-per-1", type:"setpoint", spId:"sp-flow-perm", col:8 },
      { id:"w-per-2", type:"sensor",   sensorId:"sen-flow-perm", col:4 },
    ],
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

  // LT — 4 SEPARATE set points (per Phase 2 update)
  { id:"sp-lt-src-min", type:"LT", subRole:"SOURCEMIN", groupId:"lt-uffeed", groupName:"UF Feed transfer · Operating range",
    name:"UF Feed transfer · Source Tank · Min Level",
    equipment:"Transfer Pump · UF Feed",
    targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"RECIRCULATION.LT_SOURCEMIN_01_SP",
    unit:"%", current:20, min:0, max:100,
    active:true, source:"PLC default",
    history: _hist([
      { ts:"2026-05-12T09:00:00Z", kind:"value", from:25, to:20,
        who:"op-mihir", note:"Lowered source floor to avoid cavitation" },
    ]) },
  { id:"sp-lt-src-max", type:"LT", subRole:"SOURCEMAX", groupId:"lt-uffeed", groupName:"UF Feed transfer · Operating range",
    name:"UF Feed transfer · Source Tank · Max Level",
    equipment:"Transfer Pump · UF Feed",
    targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"RECIRCULATION.LT_SOURCEMAX_02_SP",
    unit:"%", current:85, min:0, max:100,
    active:true, source:"PLC default" },
  { id:"sp-lt-dst-min", type:"LT", subRole:"DESTMIN", groupId:"lt-uffeed", groupName:"UF Feed transfer · Operating range",
    name:"UF Feed transfer · Destination Tank · Min Level",
    equipment:"Transfer Pump · UF Feed",
    targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"RECIRCULATION.LT_DESTMIN_03_SP",
    unit:"%", current:25, min:0, max:100,
    active:true, source:"PLC default" },
  { id:"sp-lt-dst-max", type:"LT", subRole:"DESTMAX", groupId:"lt-uffeed", groupName:"UF Feed transfer · Operating range",
    name:"UF Feed transfer · Destination Tank · Max Level",
    equipment:"Transfer Pump · UF Feed",
    targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"RECIRCULATION.LT_DESTMAX_04_SP",
    unit:"%", current:80, min:0, max:100,
    active:true, source:"PLC default" },

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
