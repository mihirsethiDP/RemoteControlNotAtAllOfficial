# Set Points — Developer Documentation

> **Audience:** developers implementing set-point configuration and runtime behaviour.
> Last updated: with the addition of the **Transfer Pump Set Point** type and the standalone Set Point Configuration screen.

---

## 1. What is a set point?

A **set point** is a numeric threshold or target value stored on the PLC that drives equipment behaviour (start / stop / dose / open / close / VFD output). The PLC's automation logic is fixed — only the threshold values are overwritten by operators through this software.

Every set point has an **HMI Tag** that maps 1:1 to a PLC tag. Tags are **auto-generated** by the configuration UI (read-only); the PLC integration team maps each auto-generated tag to the actual PLC tag during plant commissioning.

---

## 2. Common fields (every type)

Every set point — regardless of type — captures the following at configuration time:

| Field | Type | Required | Notes |
|---|---|---|---|
| **Set Point Type** | enum | ✅ | One of the 9 types in §3 |
| **Set Point Name** | string | ✅ | Operator-facing label (e.g. *"CASS Basin 1 high level cut-in"*) |
| **Set Point Description** | text | optional | When the set point fires, what equipment behaviour it drives |
| **Set Point Min** (safe min) | number | ✅ | Floor of the allowed override range. Values below trigger a soft warning |
| **Set Point Max** (safe max) | number | ✅ | Ceiling. Values above trigger a soft warning |
| **HMI Set Point Tag** | string | auto | Generated from `<UP_NAME>.<TYPE>[_<ROLE>]_<NN>_SP`. Read-only in UI |
| **Linked Unit Process** | reference | optional | The unit process this set point belongs to (drives Dashboard grouping) |

### Validation (server + client)
- `Min < Max` — always.
- `Current` (the live set point value the PLC reads) must satisfy `Min ≤ Current ≤ Max`.
- Name is non-empty and trimmed.
- HMI Tag uniqueness is enforced when persisting (auto-generation already keeps uniqueness via the `_NN` suffix).

### Override semantics
- The system **never blocks** an operator setpoint change.
- If the operator's new value falls **outside** `[Min, Max]`, a warning modal opens and an explicit override is required.
- Every change (in-range or override) is logged: `old → new`, `user_id`, `timestamp`, `hmi_tag`, `note`.

---

## 3. Set point types & their config questions

Each row below describes **what to ask the implementer** at configuration time.

### 3.1 Level
- **Inputs:** one reading
- **Unit:** `%`
- **Safe range:** Min, Max
- **Purpose:** Tank level threshold (e.g. "transfer pump starts at 70%")

### 3.2 DO (Dissolved Oxygen)
- **Inputs:** one reading
- **Unit:** `mg/L` *(the brief said `bar`; the platform convention is `mg/L`. Confirm with the plant team before finalising.)*
- **Safe range:** Min, Max
- **Purpose:** Drives blower ON/OFF and VFD output (RPM / Hz / current)

### 3.3 Differential Pressure
- **Inputs:** one reading
- **Unit:** `bar`
- **Safe range:** Min, Max
- **Purpose:** Triggers backwash sequence (valves ON/OFF)

### 3.4 pH
- **Inputs:** one reading
- **Unit:** `pH` (no SI unit; dimensionless 0–14)
- **Safe range:** Min, Max
- **Purpose:** Triggers dosing pumps (NaOH / HCl)

### 3.5 FRC (Free Residual Chlorine)
- **Inputs:** one reading
- **Unit:** `ppm` (or `mg/L`)
- **Safe range:** Min, Max
- **Purpose:** Triggers NaOCl dosing pump

### 3.6 ORP (Oxidation-Reduction Potential)
- **Inputs:** one reading
- **Unit:** `mV`
- **Safe range:** Min, Max (note: ORP values are commonly negative for anoxic processes)
- **Purpose:** Triggers ORP-correction dosing

### 3.7 Flow
- **Inputs:** one reading
- **Unit:** `m³/hr`
- **Safe range:** Min, Max
- **Purpose:** Changes VFD output of permeate / feed pumps (no ON/OFF toggle)

### 3.8 Time
- **Inputs:** one reading
- **Unit:** `minutes` (default) — also support `seconds` and `hours`
- **Safe range:** Min, Max
- **Purpose:** Backwash duration, decant duration, fill duration, etc.

### 3.9 Transfer Pump Set Point  ★ special case

A Transfer Pump Set Point is **logically one** set point that physically resolves to **four HMI tags** (and four PLC writes). It controls a pump that moves liquid from a **source tank** to a **destination tank**.

#### Inputs

| Sub-field | What | Each has its own |
|---|---|---|
| **Source Tank Start Level** | Level above which pump starts | min, max (safe range) |
| **Source Tank Stop Level**  | Level at/below which pump stops | min, max |
| **Destination Tank Start Level** | Level above which transfer holds | min, max |
| **Destination Tank Stop Level**  | Level at/below which transfer resumes | min, max |

All four are in `%`.

#### Validation
- **Per-tank ordering**: `Source Start ≤ Source Stop`, `Destination Start ≤ Destination Stop`.
- **Per-sub-setpoint safe ranges**: `min ≤ current ≤ max` for each of the four values independently.
- **Min < Max** on each sub-setpoint's safe range.

#### HMI Tag generation
A single Transfer Pump set point produces four tags (one per sub-role):

```
<UP_NAME>.LT_SOURCEMIN_<NN>_SP   ← Source Start
<UP_NAME>.LT_SOURCEMAX_<NN+1>_SP ← Source Stop
<UP_NAME>.LT_DESTMIN_<NN+2>_SP   ← Destination Start
<UP_NAME>.LT_DESTMAX_<NN+3>_SP   ← Destination Stop
```

Internally we tag the four set-point records with a shared **`groupId`** and **`groupName`** so the UI can re-aggregate them into one row in the Configuration screen and one card in the operator drawer/dashboard.

#### Operator behaviour
- The operator **edits all four values in one form** (single "Edit" action → 4 inputs → Save → 4 PLC writes).
- The Dashboard renders them as **one card** showing both ranges at a glance.
- Audit log writes a single grouped entry referencing all four old → new pairs.

---

## 4. Data model (TypeScript-ish)

```ts
type SetpointType =
  | "Level" | "DO" | "Differential Pressure" | "pH" | "FRC" | "ORP"
  | "Flow" | "Time" | "Transfer Pump";

interface SetpointBase {
  id: string;
  type: SetpointType;
  name: string;
  description?: string;
  unit: string;
  current: number;     // live PLC tag value
  min: number;         // safe range floor
  max: number;         // safe range ceiling
  hmiTag: string;      // auto-generated
  active: boolean;     // false = disabled at config layer
  unitProcessId?: string;
  source: string;      // 'PLC default' | 'Operator override · DD MMM' | 'Created · DD MMM'
  history: Array<{
    ts: string;
    kind: "value" | "config";
    from?: any; to?: any;
    changes?: Record<string, { from: any; to: any }>;
    who: string;
    note?: string;
  }>;
}

// Single-value types share SetpointBase as-is.

// Transfer Pump materialises as FOUR rows of the same shape with these extras:
interface TransferPumpMember extends SetpointBase {
  type: "Transfer Pump";          // stored as "LT" historically — surface as "Transfer Pump"
  subRole: "SOURCEMIN" | "SOURCEMAX" | "DESTMIN" | "DESTMAX";
  groupId: string;                // shared across all 4
  groupName: string;              // shared
}
```

> Backwards-compat note: the prototype's stored `type` for Transfer Pump records is `"LT"` (legacy). The display label is `"Transfer Pump Set Point"`. New code should accept both spellings.

---

## 5. Where set points get configured

The prototype exposes **two** configuration surfaces:

| Surface | Audience | What it does | Where |
|---|---|---|---|
| **Set Point Configuration** | Implementer / Admin | Plain list of every set point; CRUD with the common fields above + Transfer Pump sub-form | Page selector → *Set Point Configuration* |
| **Studio** | Implementer | Drag-arrange dashboard layout; per-widget inspector also exposes the full set-point editor | Page selector → *⚙ Studio (configure)* |

Both surfaces write to the same global registry. The Dashboard and the Plant View drawer **only read** from it.

The simple Configuration screen exists for situations where the implementer just needs to add or edit set points without touching the visual dashboard.

---

## 6. Auto-generated HMI tag rules

```
Tag = upper(slug(unitProcessName)) + "." + upper(slug(type)) + roleSuffix + "_" + zeroPad(index, 2) + "_SP"
```

Examples:
- `AERATION.DO_03_SP`
- `RE_CIRCULATION.LT_SOURCEMIN_05_SP`
- `PSF_1_CYCLE.TIME_01_SP`

Slugging rule: `[^A-Z0-9]+` → `_`, then strip leading/trailing `_`.

---

## 7. Audit log fields (every set-point write)

```json
{
  "ts": "2026-06-01T11:32:14.503Z",
  "user_id": "op-mihir",
  "hmi_tag": "AERATION.DO_03_SP",
  "set_point_id": "sp-do-cass1",
  "from": 2.0,
  "to": 2.3,
  "in_safe_range": true,
  "override_reason": null,
  "note": "Bumped target after settling phase",
  "unit_process_id": "up-aeration"
}
```

For Transfer Pump writes, emit **four entries** (one per sub-role) sharing a `group_change_id` so the log viewer can re-collapse them.

---

## 8. Open questions for the PLC integration team

1. **Tag mapping** — confirm the format the PLC team needs for the auto-generated tag → PLC tag mapping table (CSV? UI?).
2. **Unit consistency** — finalise DO unit (`mg/L` vs `bar`) and FRC unit (`ppm` vs `mg/L`) with the domain team.
3. **Transfer Pump composite write** — atomic 4-write transaction or sequential? What's the recovery path if write #3 fails?
4. **Safe range vs hard range** — Phase 2 doc mentioned soft caution bands inside the hard min/max. Are we keeping that distinction in v1 of this screen, or only the single safe-range pair (Min/Max)?
