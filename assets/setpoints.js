// =====================================================================
// Set-points registry — only 5 types supported per Phase 2 spec:
//   DO · PT · LT (Transfer Pump) · Flow · Switchover Time
// =====================================================================

window.SP_TYPES = ["DO", "PT", "LT", "Flow", "Switchover Time"];
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
