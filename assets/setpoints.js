// =====================================================================
// Set-points registry — child-level values override the PLC threshold.
// Logic is fed into the PLC; the HMI Set Point Tag is the address the
// PLC reads from, and is what gets overwritten when an operator edits.
// =====================================================================
window.SETPOINTS = [
  { id:"sp-lvl-cass1", type:"Level", name:"CASS Basin 1 — high level cut-in",
    equipment:"CASS Basin 1", targets:["RECIRC_A1","RECIRC_A2"],
    hmiTag:"LIT_201.LEVEL_HIGH_SP",
    unit:"%", current:70, min:55, max:90, active:true, source:"PLC default" },

  { id:"sp-lvl-cass2", type:"Level", name:"CASS Basin 2 — high level cut-in",
    equipment:"CASS Basin 2", targets:["RECIRC_B1","RECIRC_B2"],
    hmiTag:"LIT_202.LEVEL_HIGH_SP",
    unit:"%", current:72, min:55, max:90, active:true, source:"Operator override · 04 May" },

  { id:"sp-do-cass1", type:"DO", name:"Dissolved Oxygen — Zone-3 Basin 1",
    equipment:"CASS Basin 1 · Zone-3", targets:["BLOWER1","BLOWER2","AIR1"],
    hmiTag:"AIT_101.DO_SP",
    unit:"ppm", current:2.0, min:0.5, max:4.0, active:true, source:"PLC default" },

  { id:"sp-do-cass2", type:"DO", name:"Dissolved Oxygen — Zone-3 Basin 2",
    equipment:"CASS Basin 2 · Zone-3", targets:["BLOWER3","BLOWER4","AIR2"],
    hmiTag:"AIT_102.DO_SP",
    unit:"ppm", current:1.8, min:0.5, max:4.0, active:true, source:"Operator override · 22 Apr" },

  { id:"sp-dp-psf1", type:"Differential Pressure", name:"PSF-1 backwash trigger",
    equipment:"PSF-1", targets:["DECANTER"],
    hmiTag:"PIT_301.DP_BW_SP",
    unit:"bar", current:0.8, min:0.3, max:1.5, active:true, source:"PLC default" },

  { id:"sp-dp-calc-uf1", type:"Differential Pressure (calculated)", name:"UF-1 calculated TMP trigger",
    equipment:"UF-1", targets:["DECANTER"],
    hmiTag:"UF_001.TMP_CALC_SP",
    unit:"bar", current:1.2, min:0.5, max:2.0, active:false, source:"Disabled" },

  { id:"sp-ph-inlet", type:"pH", name:"Inlet pH dosing trigger",
    equipment:"Equalization Tank", targets:["DECANTER"],
    hmiTag:"AIT_401.PH_SP",
    unit:"pH", current:7.0, min:4.0, max:10.0, active:true, source:"PLC default" },

  { id:"sp-frc-clr", type:"FRC", name:"Free Residual Chlorine — outlet",
    equipment:"Chlorine Contact Tank", targets:["DECANTER"],
    hmiTag:"AIT_501.FRC_SP",
    unit:"ppm", current:0.5, min:0.1, max:2.0, active:true, source:"PLC default" },

  { id:"sp-orp-cass1", type:"ORP", name:"ORP target — Zone-2 Basin 1",
    equipment:"CASS Basin 1 · Zone-2", targets:["DECANTER"],
    hmiTag:"AIT_103.ORP_SP",
    unit:"mV", current:-100, min:-300, max:0, active:true, source:"PLC default" },

  { id:"sp-flow-feed", type:"Flow", name:"UF Feed Pump — flow target",
    equipment:"UF Feed Pump A", targets:["DECANTER"],
    hmiTag:"FIT_601.FLOW_SP",
    unit:"m³/hr", current:90, min:40, max:140, active:true, source:"Operator override · 18 Apr" },

  { id:"sp-time-bw", type:"Time", name:"PSF-1 backwash duration",
    equipment:"PSF-1", targets:["DECANTER"],
    hmiTag:"PSF_001.BW_DUR_SP",
    unit:"s", current:180, min:60, max:600, active:true, source:"PLC default" },

  { id:"sp-time-decant", type:"Time", name:"SBR Decant duration",
    equipment:"CASS Basin 1 & 2", targets:["DECANTER"],
    hmiTag:"SBR_001.DECANT_DUR_SP",
    unit:"min", current:45, min:20, max:90, active:true, source:"PLC default" },
];

window.SP_TYPE_DEFAULTS = {
  "Level":   { unit:"%" },
  "DO":      { unit:"ppm" },
  "Differential Pressure": { unit:"bar" },
  "Differential Pressure (calculated)": { unit:"bar" },
  "pH":      { unit:"pH" },
  "FRC":     { unit:"ppm" },
  "ORP":     { unit:"mV" },
  "Flow":    { unit:"m³/hr" },
  "Time":    { unit:"s" },
};
