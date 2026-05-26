// =====================================================================
// Set-points registry — child-level values that override the PLC threshold.
// Logic is fed into the PLC; we only change the numeric set-point or time.
// =====================================================================
window.SETPOINTS = [
  // ------- LEVEL set-points -------
  {
    id: "sp-lvl-cass1",
    type: "Level",
    name: "CASS Basin 1 — high level cut-in",
    equipment: "CASS Basin 1",
    targets: ["RECIRC_A1","RECIRC_A2"],
    unit: "%",
    current: 70, default: 70, min: 55, max: 90, safeMin: 60, safeMax: 80,
    description: "When basin level ≥ this value, the PLC starts the assigned Re-Circulation pumps to draw down.",
    behaviour: "Starts/stops Re-Circulation Pumps A1 & A2 based on threshold crossing.",
    active: true, source: "PLC default",
  },
  {
    id: "sp-lvl-cass2",
    type: "Level",
    name: "CASS Basin 2 — high level cut-in",
    equipment: "CASS Basin 2",
    targets: ["RECIRC_B1","RECIRC_B2"],
    unit: "%",
    current: 72, default: 70, min: 55, max: 90, safeMin: 60, safeMax: 80,
    description: "When basin level ≥ this value, the PLC starts the assigned Re-Circulation pumps to draw down.",
    behaviour: "Starts/stops Re-Circulation Pumps B1 & B2 based on threshold crossing.",
    active: true, source: "Operator override · 04 May",
  },

  // ------- DO set-points (drive blowers + VFD) -------
  {
    id: "sp-do-cass1",
    type: "DO",
    name: "Dissolved Oxygen — Zone-3 Basin 1",
    equipment: "CASS Basin 1 · Zone-3",
    targets: ["BLOWER1","BLOWER2","AIR1"],
    unit: "ppm",
    current: 2.0, default: 2.0, min: 0.5, max: 4.0, safeMin: 1.5, safeMax: 2.5,
    description: "DO closed-loop target. Below this, blowers ramp up; above this, they ramp down.",
    behaviour: "Modulates Blower 1/2 ON/OFF and VFD output (RPM, Hz, current).",
    active: true, source: "PLC default",
    vfd: { rpm: 1450, freq: 47.5, current: 12.4 },
  },
  {
    id: "sp-do-cass2",
    type: "DO",
    name: "Dissolved Oxygen — Zone-3 Basin 2",
    equipment: "CASS Basin 2 · Zone-3",
    targets: ["BLOWER3","BLOWER4","AIR2"],
    unit: "ppm",
    current: 1.8, default: 2.0, min: 0.5, max: 4.0, safeMin: 1.5, safeMax: 2.5,
    description: "DO closed-loop target. Below this, blowers ramp up; above this, they ramp down.",
    behaviour: "Modulates Blower 3/4 ON/OFF and VFD output (RPM, Hz, current).",
    active: true, source: "Operator override · 22 Apr",
    vfd: { rpm: 1380, freq: 46.0, current: 11.8 },
  },

  // ------- Differential Pressure -------
  {
    id: "sp-dp-psf1",
    type: "Differential Pressure",
    name: "PSF-1 backwash trigger",
    equipment: "PSF-1",
    targets: ["DECANTER"],
    unit: "bar",
    current: 0.8, default: 0.8, min: 0.3, max: 1.5, safeMin: 0.5, safeMax: 1.0,
    description: "When ΔP across PSF-1 exceeds threshold, a backwash cycle is initiated.",
    behaviour: "Triggers backwash valve sequence (ON/OFF of inlet, drain, and air valves).",
    active: true, source: "PLC default",
  },
  {
    id: "sp-dp-calc-uf1",
    type: "Differential Pressure (calculated)",
    name: "UF-1 calculated TMP trigger",
    equipment: "UF-1",
    targets: ["DECANTER"],
    unit: "bar",
    current: 1.2, default: 1.2, min: 0.5, max: 2.0, safeMin: 0.8, safeMax: 1.5,
    description: "Calculated trans-membrane pressure threshold. Triggers backwash valve sequencing.",
    behaviour: "Triggers UF-1 backwash valves; bypasses if interlocked.",
    active: false, source: "Disabled",
  },

  // ------- pH -------
  {
    id: "sp-ph-inlet",
    type: "pH",
    name: "Inlet pH dosing trigger",
    equipment: "Equalization Tank",
    targets: ["DECANTER"],
    unit: "pH",
    current: 7.0, default: 7.0, min: 4.0, max: 10.0, safeMin: 6.5, safeMax: 8.0,
    description: "Target inlet pH. Below safe minimum, NaOH dosing starts; above, HCl dosing starts.",
    behaviour: "Triggers dosing pumps (NaOH or HCl) ON/OFF.",
    active: true, source: "PLC default",
  },

  // ------- FRC -------
  {
    id: "sp-frc-clr",
    type: "FRC",
    name: "Free Residual Chlorine — outlet",
    equipment: "Chlorine Contact Tank",
    targets: ["DECANTER"],
    unit: "ppm",
    current: 0.5, default: 0.5, min: 0.1, max: 2.0, safeMin: 0.2, safeMax: 1.0,
    description: "Target outlet FRC. Below this, NaOCl dosing pumps start.",
    behaviour: "Triggers NaOCl dosing pump ON/OFF.",
    active: true, source: "PLC default",
  },

  // ------- ORP -------
  {
    id: "sp-orp-cass1",
    type: "ORP",
    name: "ORP target — Zone-2 Basin 1",
    equipment: "CASS Basin 1 · Zone-2",
    targets: ["DECANTER"],
    unit: "mV",
    current: -100, default: -100, min: -300, max: 0, safeMin: -200, safeMax: -50,
    description: "Target ORP for anoxic phase. Drives FeCl3 dosing.",
    behaviour: "Triggers FeCl3 dosing pump ON/OFF.",
    active: true, source: "PLC default",
  },

  // ------- Flow (VFD only) -------
  {
    id: "sp-flow-feed",
    type: "Flow",
    name: "UF Feed Pump — flow target",
    equipment: "UF Feed Pump A",
    targets: ["DECANTER"],
    unit: "m³/hr",
    current: 90, default: 90, min: 40, max: 140, safeMin: 70, safeMax: 110,
    description: "Closed-loop flow target. PLC modulates VFD to maintain.",
    behaviour: "Changes VFD output (RPM, Hz, current) — does not toggle ON/OFF.",
    active: true, source: "Operator override · 18 Apr",
    vfd: { rpm: 2580, freq: 43.0, current: 8.9 },
  },

  // ------- Time set-points -------
  {
    id: "sp-time-bw",
    type: "Time",
    name: "PSF-1 backwash duration",
    equipment: "PSF-1",
    targets: ["DECANTER"],
    unit: "s",
    current: 180, default: 180, min: 60, max: 600, safeMin: 120, safeMax: 300,
    description: "Total backwash cycle duration. Includes drain + air-scour + rinse.",
    behaviour: "Sets total time the backwash sequence runs.",
    active: true, source: "PLC default",
  },
  {
    id: "sp-time-decant",
    type: "Time",
    name: "SBR Decant duration",
    equipment: "CASS Basin 1 & 2",
    targets: ["DECANTER"],
    unit: "min",
    current: 45, default: 45, min: 20, max: 90, safeMin: 30, safeMax: 60,
    description: "Time the decanter runs per SBR cycle.",
    behaviour: "Sets decanter ON-time per cycle.",
    active: true, source: "PLC default",
  },
];
