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

  // SBR 1 Cycle — RUN TIME / actual readings paired with each set point
  { id:"sen-sbr-fill-rt",    name:"Filling Run Time",      tag:"SBR1.FILL_RT",      unit:"min", value:12 },
  { id:"sen-sbr-blower-rt",  name:"SBR Blower Run Time",   tag:"SBR1.BLW_RT",       unit:"min", value:45 },
  { id:"sen-sbr-settle-rt",  name:"Settling Run Time",     tag:"SBR1.SET_RT",       unit:"min", value:30 },
  { id:"sen-sbr-decant-rt",  name:"Decanting Run Time",    tag:"SBR1.DEC_RT",       unit:"min", value:25 },
  { id:"sen-sbr-sludge-rt",  name:"Sludge Wasting Run",    tag:"SBR1.SLG_RT",       unit:"min", value:5  },
  { id:"sen-sbr-idle-rt",    name:"Idle Run Time",         tag:"SBR1.IDLE_RT",      unit:"min", value:60 },
  { id:"sen-sbr-tank-act",   name:"SBR 1 Tank Actual",     tag:"LIT_SBR1.ACT",      unit:"%",   value:62 },
  { id:"sen-sbr-do-act",     name:"DO 1 Actual",           tag:"AIT_SBR1.LIVE",     unit:"mg/L", value:2.1 },

  // PSF 1 Cycle
  { id:"sen-psf-preser-rt",  name:"PSF 1 Pre-Service Run", tag:"PSF1.PRESER_RT",    unit:"min", value:3  },
  { id:"sen-psf-drain-rt",   name:"PSF 1 Drain Run",       tag:"PSF1.DRAIN_RT",     unit:"min", value:5  },
  { id:"sen-psf-aer-rt",     name:"PSF 1 Aeration Run",    tag:"PSF1.AER_RT",       unit:"min", value:8  },
  { id:"sen-psf-dwell-rt",   name:"PSF 1 Dwell Run",       tag:"PSF1.DWELL_RT",     unit:"min", value:4  },
  { id:"sen-psf-fill-rt",    name:"PSF 1 Fill Run",        tag:"PSF1.FILL_RT",      unit:"min", value:7  },
  { id:"sen-psf-bw-rt",      name:"PSF 1 Backwash Run",    tag:"PSF1.BW_RT",        unit:"min", value:10 },
  { id:"sen-psf-settle-rt",  name:"PSF 1 Settle Run",      tag:"PSF1.SET_RT",       unit:"min", value:2  },
  { id:"sen-psf-fastrn-rt",  name:"PSF 1 Fast Rinse Run",  tag:"PSF1.FRN_RT",       unit:"min", value:4  },
  { id:"sen-psf-rest-rt",    name:"PSF 1 Rest Run",        tag:"PSF1.REST_RT",      unit:"min", value:6  },
  { id:"sen-psf-ffeed-act",  name:"Filter Feed Tank Act",  tag:"LIT_FF.ACT",        unit:"%",   value:55 },
  { id:"sen-psf-ufeed-act",  name:"UF Feed Tank Act",      tag:"LIT_UF.ACT",        unit:"%",   value:48 },
  { id:"sen-psf-bw-press",   name:"Backwash Pressure Act", tag:"PIT_PSF.ACT",       unit:"bar", value:0.42 },

  // RO 1 Cycle
  { id:"sen-ro-orp-act",     name:"RO 1 ORP Actual",       tag:"AIT_RO1_ORP.ACT",   unit:"mV",     value:120 },
  { id:"sen-ro-cond-act",    name:"RO 1 Permeate Cond",    tag:"CIT_RO1.ACT",       unit:"μS/cm", value:85 },
  { id:"sen-ro-flow-act",    name:"RO 1 Permeate Flow",    tag:"FIT_RO1.ACT",       unit:"m³/hr", value:42 },
  { id:"sen-ro-ufperm-act",  name:"UF Permeate Tank",      tag:"LIT_UFP.ACT",       unit:"%",     value:60 },
  { id:"sen-ro-permsto-act", name:"RO Permeate Storage",   tag:"LIT_ROS.ACT",       unit:"%",     value:75 },
  { id:"sen-ro-inlet-press", name:"RO 1 Inlet Pressure",   tag:"PIT_ROIN.ACT",      unit:"bar",   value:11.5 },
  { id:"sen-ro-rej-flow",    name:"RO 1 Reject Flow",      tag:"FIT_ROREJ.ACT",     unit:"m³/hr", value:8  },
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

  // ============= HMI-mirrored cycles =============
  {
    id: "up-sbr1",
    name: "SBR 1 Cycle",
    description: "Sequential Batch Reactor — full cycle: fill, aerate, settle, decant, waste, idle. Mirrors the HMI SBR 1 page.",
    equipmentIds: ["SBR1_INLET","BLOWER1","BLOWER2","DECANTER","SLUDGE_A1","SLUDGE_A2","RECIRC_A1"],
    setpointIds: ["sp-sbr-fill","sp-sbr-blower","sp-sbr-settle","sp-sbr-decant","sp-sbr-sludge","sp-sbr-idle","sp-sbr-start","sp-sbr-stop","sp-sbr-do1","sp-sbr-dec-set"],
    layout: [
      { id:"w-sbr-h1", type:"header", text:"Cycle Times · Set vs Run", col:12 },
      { id:"w-sbr-1a", type:"setpoint", spId:"sp-sbr-fill",   col:6 },
      { id:"w-sbr-1b", type:"sensor",   sensorId:"sen-sbr-fill-rt",   col:6 },
      { id:"w-sbr-2a", type:"setpoint", spId:"sp-sbr-blower", col:6 },
      { id:"w-sbr-2b", type:"sensor",   sensorId:"sen-sbr-blower-rt", col:6 },
      { id:"w-sbr-3a", type:"setpoint", spId:"sp-sbr-settle", col:6 },
      { id:"w-sbr-3b", type:"sensor",   sensorId:"sen-sbr-settle-rt", col:6 },
      { id:"w-sbr-4a", type:"setpoint", spId:"sp-sbr-decant", col:6 },
      { id:"w-sbr-4b", type:"sensor",   sensorId:"sen-sbr-decant-rt", col:6 },
      { id:"w-sbr-5a", type:"setpoint", spId:"sp-sbr-sludge", col:6 },
      { id:"w-sbr-5b", type:"sensor",   sensorId:"sen-sbr-sludge-rt", col:6 },
      { id:"w-sbr-6a", type:"setpoint", spId:"sp-sbr-idle",   col:6 },
      { id:"w-sbr-6b", type:"sensor",   sensorId:"sen-sbr-idle-rt",   col:6 },
      { id:"w-sbr-d1", type:"divider", col:12 },
      { id:"w-sbr-h2", type:"header", text:"Tank Level · Start / Stop / Actual", col:12 },
      { id:"w-sbr-7a", type:"setpoint", spId:"sp-sbr-start", col:4 },
      { id:"w-sbr-7b", type:"setpoint", spId:"sp-sbr-stop",  col:4 },
      { id:"w-sbr-7c", type:"sensor",   sensorId:"sen-sbr-tank-act", col:4 },
      { id:"w-sbr-d2", type:"divider", col:12 },
      { id:"w-sbr-h3", type:"header", text:"DO · Decant Set Point", col:12 },
      { id:"w-sbr-8a", type:"setpoint", spId:"sp-sbr-do1",     col:6 },
      { id:"w-sbr-8b", type:"sensor",   sensorId:"sen-sbr-do-act", col:6 },
      { id:"w-sbr-9",  type:"setpoint", spId:"sp-sbr-dec-set", col:12 },
    ],
  },
  {
    id: "up-psf1",
    name: "PSF 1 Cycle",
    description: "Pressure Sand Filter — set/run times for the nine cycle phases plus tank-level cut-ins and backwash pressure.",
    equipmentIds: [],
    setpointIds: ["sp-psf-preser","sp-psf-drain","sp-psf-aer","sp-psf-dwell","sp-psf-fill","sp-psf-bw","sp-psf-settle","sp-psf-fastrn","sp-psf-rest","sp-psf-ffstart","sp-psf-ffstop","sp-psf-ufstart","sp-psf-ufstop","sp-psf-bwpress"],
    layout: [
      { id:"w-psf-h1", type:"header", text:"Cycle Times · Set vs Run", col:12 },
      { id:"w-psf-1a", type:"setpoint", spId:"sp-psf-preser", col:6 }, { id:"w-psf-1b", type:"sensor", sensorId:"sen-psf-preser-rt", col:6 },
      { id:"w-psf-2a", type:"setpoint", spId:"sp-psf-drain",  col:6 }, { id:"w-psf-2b", type:"sensor", sensorId:"sen-psf-drain-rt",  col:6 },
      { id:"w-psf-3a", type:"setpoint", spId:"sp-psf-aer",    col:6 }, { id:"w-psf-3b", type:"sensor", sensorId:"sen-psf-aer-rt",    col:6 },
      { id:"w-psf-4a", type:"setpoint", spId:"sp-psf-dwell",  col:6 }, { id:"w-psf-4b", type:"sensor", sensorId:"sen-psf-dwell-rt",  col:6 },
      { id:"w-psf-5a", type:"setpoint", spId:"sp-psf-fill",   col:6 }, { id:"w-psf-5b", type:"sensor", sensorId:"sen-psf-fill-rt",   col:6 },
      { id:"w-psf-6a", type:"setpoint", spId:"sp-psf-bw",     col:6 }, { id:"w-psf-6b", type:"sensor", sensorId:"sen-psf-bw-rt",     col:6 },
      { id:"w-psf-7a", type:"setpoint", spId:"sp-psf-settle", col:6 }, { id:"w-psf-7b", type:"sensor", sensorId:"sen-psf-settle-rt", col:6 },
      { id:"w-psf-8a", type:"setpoint", spId:"sp-psf-fastrn", col:6 }, { id:"w-psf-8b", type:"sensor", sensorId:"sen-psf-fastrn-rt", col:6 },
      { id:"w-psf-9a", type:"setpoint", spId:"sp-psf-rest",   col:6 }, { id:"w-psf-9b", type:"sensor", sensorId:"sen-psf-rest-rt",   col:6 },
      { id:"w-psf-d1", type:"divider", col:12 },
      { id:"w-psf-h2", type:"header", text:"Tank Levels · Start / Stop / Actual", col:12 },
      { id:"w-psf-10a", type:"setpoint", spId:"sp-psf-ffstart", col:4 }, { id:"w-psf-10b", type:"setpoint", spId:"sp-psf-ffstop", col:4 }, { id:"w-psf-10c", type:"sensor", sensorId:"sen-psf-ffeed-act", col:4 },
      { id:"w-psf-11a", type:"setpoint", spId:"sp-psf-ufstart", col:4 }, { id:"w-psf-11b", type:"setpoint", spId:"sp-psf-ufstop", col:4 }, { id:"w-psf-11c", type:"sensor", sensorId:"sen-psf-ufeed-act", col:4 },
      { id:"w-psf-d2", type:"divider", col:12 },
      { id:"w-psf-h3", type:"header", text:"Backwash Pressure", col:12 },
      { id:"w-psf-12a", type:"setpoint", spId:"sp-psf-bwpress", col:6 }, { id:"w-psf-12b", type:"sensor", sensorId:"sen-psf-bw-press", col:6 },
    ],
  },
  {
    id: "up-ro1",
    name: "RO 1 Cycle",
    description: "Reverse Osmosis — ORP/conductivity/flow set points, plus storage tank level cut-ins and read-only pressures.",
    equipmentIds: [],
    setpointIds: ["sp-ro-orp","sp-ro-cond","sp-ro-flow","sp-ro-ufstart","sp-ro-ufstop","sp-ro-stostart","sp-ro-stostop"],
    layout: [
      { id:"w-ro-h1", type:"header", text:"Process Set Values vs Actual", col:12 },
      { id:"w-ro-1a", type:"setpoint", spId:"sp-ro-orp",  col:6 }, { id:"w-ro-1b", type:"sensor", sensorId:"sen-ro-orp-act",  col:6 },
      { id:"w-ro-2a", type:"setpoint", spId:"sp-ro-cond", col:6 }, { id:"w-ro-2b", type:"sensor", sensorId:"sen-ro-cond-act", col:6 },
      { id:"w-ro-3a", type:"setpoint", spId:"sp-ro-flow", col:6 }, { id:"w-ro-3b", type:"sensor", sensorId:"sen-ro-flow-act", col:6 },
      { id:"w-ro-d1", type:"divider", col:12 },
      { id:"w-ro-h2", type:"header", text:"Tank Levels · Start / Stop / Actual", col:12 },
      { id:"w-ro-4a", type:"setpoint", spId:"sp-ro-ufstart",  col:4 }, { id:"w-ro-4b", type:"setpoint", spId:"sp-ro-ufstop",  col:4 }, { id:"w-ro-4c", type:"sensor", sensorId:"sen-ro-ufperm-act",  col:4 },
      { id:"w-ro-5a", type:"setpoint", spId:"sp-ro-stostart", col:4 }, { id:"w-ro-5b", type:"setpoint", spId:"sp-ro-stostop", col:4 }, { id:"w-ro-5c", type:"sensor", sensorId:"sen-ro-permsto-act", col:4 },
      { id:"w-ro-d2", type:"divider", col:12 },
      { id:"w-ro-h3", type:"header", text:"Live readings only · no set point", col:12 },
      { id:"w-ro-6",  type:"sensor", sensorId:"sen-ro-inlet-press", col:6 },
      { id:"w-ro-7",  type:"sensor", sensorId:"sen-ro-rej-flow",    col:6 },
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

  // ===== SBR 1 CYCLE (HMI-mirrored) =====
  { id:"sp-sbr-fill",    type:"Time",   name:"SBR 1 · Filling Time",
    equipment:"SBR 1 Tank", targets:["SBR1_INLET"],
    hmiTag:"SBR1.FILL_TIME_SP", unit:"min", current:30, min:5, max:120, active:true, source:"PLC default" },
  { id:"sp-sbr-blower",  type:"Time",   name:"SBR 1 · Blower Time",
    equipment:"SBR 1 Tank", targets:["BLOWER1","BLOWER2"],
    hmiTag:"SBR1.BLW_TIME_SP", unit:"min", current:90, min:30, max:240, active:true, source:"PLC default" },
  { id:"sp-sbr-settle",  type:"Time",   name:"SBR 1 · Settling Time",
    equipment:"SBR 1 Tank", targets:["BLOWER1","BLOWER2"],
    hmiTag:"SBR1.SET_TIME_SP", unit:"min", current:45, min:15, max:120, active:true, source:"PLC default" },
  { id:"sp-sbr-decant",  type:"Time",   name:"SBR 1 · Decanting Time",
    equipment:"SBR 1 Tank", targets:["DECANTER"],
    hmiTag:"SBR1.DEC_TIME_SP", unit:"min", current:30, min:10, max:90, active:true, source:"PLC default" },
  { id:"sp-sbr-sludge",  type:"Time",   name:"SBR 1 · Sludge Wasting Time",
    equipment:"SBR 1 Tank", targets:["SLUDGE_A1","SLUDGE_A2"],
    hmiTag:"SBR1.SLG_TIME_SP", unit:"min", current:5, min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-sbr-idle",    type:"Time",   name:"SBR 1 · Idle Time",
    equipment:"SBR 1 Tank", targets:[],
    hmiTag:"SBR1.IDLE_TIME_SP", unit:"min", current:60, min:10, max:180, active:true, source:"PLC default" },
  { id:"sp-sbr-start",   type:"Level",  name:"SBR 1 · Tank Start Level",
    equipment:"SBR 1 Tank", targets:["RECIRC_A1"],
    hmiTag:"SBR1.START_LVL_SP", unit:"%", current:30, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-sbr-stop",    type:"Level",  name:"SBR 1 · Tank Stop Level",
    equipment:"SBR 1 Tank", targets:["RECIRC_A1"],
    hmiTag:"SBR1.STOP_LVL_SP", unit:"%", current:85, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-sbr-do1",     type:"DO",     name:"SBR 1 · DO Set Point",
    equipment:"SBR 1 Tank", targets:["BLOWER1","BLOWER2"],
    hmiTag:"SBR1.DO_SP", unit:"mg/L", current:2.0, min:0.5, max:4.0, active:true, source:"PLC default" },
  { id:"sp-sbr-dec-set", type:"Level",  name:"SBR 1 · Decant Set Point",
    equipment:"Decanter", targets:["DECANTER"],
    hmiTag:"SBR1.DEC_LVL_SP", unit:"%", current:45, min:10, max:90, active:true, source:"PLC default" },

  // ===== PSF 1 CYCLE =====
  { id:"sp-psf-preser",  type:"Time",   name:"PSF 1 · Pre-Service Time", equipment:"PSF 1", targets:[], hmiTag:"PSF1.PRESER_TIME_SP", unit:"min", current:3,  min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-psf-drain",   type:"Time",   name:"PSF 1 · Drain Time",       equipment:"PSF 1", targets:[], hmiTag:"PSF1.DRAIN_TIME_SP",  unit:"min", current:5,  min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-psf-aer",     type:"Time",   name:"PSF 1 · Aeration Time",    equipment:"PSF 1", targets:[], hmiTag:"PSF1.AER_TIME_SP",    unit:"min", current:8,  min:1, max:60, active:true, source:"PLC default" },
  { id:"sp-psf-dwell",   type:"Time",   name:"PSF 1 · Dwell Time",       equipment:"PSF 1", targets:[], hmiTag:"PSF1.DWELL_TIME_SP",  unit:"min", current:4,  min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-psf-fill",    type:"Time",   name:"PSF 1 · Fill Time",        equipment:"PSF 1", targets:[], hmiTag:"PSF1.FILL_TIME_SP",   unit:"min", current:7,  min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-psf-bw",      type:"Time",   name:"PSF 1 · Backwash Time",    equipment:"PSF 1", targets:[], hmiTag:"PSF1.BW_TIME_SP",     unit:"min", current:10, min:1, max:60, active:true, source:"PLC default" },
  { id:"sp-psf-settle",  type:"Time",   name:"PSF 1 · Settle Time",      equipment:"PSF 1", targets:[], hmiTag:"PSF1.SET_TIME_SP",    unit:"min", current:2,  min:1, max:15, active:true, source:"PLC default" },
  { id:"sp-psf-fastrn",  type:"Time",   name:"PSF 1 · Fast Rinse Time",  equipment:"PSF 1", targets:[], hmiTag:"PSF1.FRN_TIME_SP",    unit:"min", current:4,  min:1, max:30, active:true, source:"PLC default" },
  { id:"sp-psf-rest",    type:"Time",   name:"PSF 1 · Rest Time",        equipment:"PSF 1", targets:[], hmiTag:"PSF1.REST_TIME_SP",   unit:"min", current:6,  min:1, max:60, active:true, source:"PLC default" },
  { id:"sp-psf-ffstart", type:"Level",  name:"Filter Feed · Start Level",equipment:"PSF 1", targets:[], hmiTag:"PSF1.FF_START_SP",    unit:"%",   current:25, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-psf-ffstop",  type:"Level",  name:"Filter Feed · Stop Level", equipment:"PSF 1", targets:[], hmiTag:"PSF1.FF_STOP_SP",     unit:"%",   current:85, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-psf-ufstart", type:"Level",  name:"UF Feed · Start Level",    equipment:"PSF 1", targets:[], hmiTag:"PSF1.UF_START_SP",    unit:"%",   current:30, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-psf-ufstop",  type:"Level",  name:"UF Feed · Stop Level",     equipment:"PSF 1", targets:[], hmiTag:"PSF1.UF_STOP_SP",     unit:"%",   current:80, min:0, max:100, active:true, source:"PLC default" },
  { id:"sp-psf-bwpress", type:"PT",     name:"PSF 1 · Backwash Pressure",equipment:"PSF 1", targets:[], hmiTag:"PSF1.BW_PRESS_SP",    unit:"bar", current:0.5, min:0.1, max:1.5, active:true, source:"PLC default" },

  // ===== RO 1 CYCLE =====
  { id:"sp-ro-orp",      type:"ORP",          name:"RO 1 · ORP Value",          equipment:"RO 1", targets:[], hmiTag:"RO1.ORP_SP",        unit:"mV",     current:150, min:0,   max:600, active:true, source:"PLC default" },
  { id:"sp-ro-cond",     type:"Conductivity", name:"RO 1 · Permeate Cond.",     equipment:"RO 1", targets:[], hmiTag:"RO1.COND_SP",       unit:"μS/cm",  current:80,  min:10,  max:300, active:true, source:"PLC default" },
  { id:"sp-ro-flow",     type:"Flow",         name:"RO 1 · Permeate Flow",      equipment:"RO 1", targets:[], hmiTag:"RO1.FLOW_SP",       unit:"m³/hr", current:40,  min:10,  max:80,  active:true, source:"PLC default" },
  { id:"sp-ro-ufstart",  type:"Level",        name:"UF Permeate · Start Level", equipment:"RO 1", targets:[], hmiTag:"RO1.UFPSTART_SP",   unit:"%",     current:30,  min:0,   max:100, active:true, source:"PLC default" },
  { id:"sp-ro-ufstop",   type:"Level",        name:"UF Permeate · Stop Level",  equipment:"RO 1", targets:[], hmiTag:"RO1.UFPSTOP_SP",    unit:"%",     current:85,  min:0,   max:100, active:true, source:"PLC default" },
  { id:"sp-ro-stostart", type:"Level",        name:"RO Storage · Start Level",  equipment:"RO 1", targets:[], hmiTag:"RO1.STOSTART_SP",   unit:"%",     current:40,  min:0,   max:100, active:true, source:"PLC default" },
  { id:"sp-ro-stostop",  type:"Level",        name:"RO Storage · Stop Level",   equipment:"RO 1", targets:[], hmiTag:"RO1.STOSTOP_SP",    unit:"%",     current:90,  min:0,   max:100, active:true, source:"PLC default" },
];
