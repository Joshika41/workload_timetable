# B.Sc. Computer Science and MCA Provisional Room & Section Reconciliation

## 1. Executive Summary

Phase 6.5 prepares confirmed section structures and provisional room preferences for **B.Sc. Computer Science** and **MCA (Regular)** to enable a restricted, non-publishable timetable preview.

Key principles enforced:
1. **Zero Invented Data:** Unknown student counts and unverified room capacities remain explicitly unpopulated (`None` / blank).
2. **Exclusion of MCA Gen AI:** As directed, MCA Gen AI is excluded from the MCA PG scope and provisional room assignment.
3. **Provisional Scope Integrity:** Block 5 (B5) rooms are assigned to B.Sc. CS, and PG Block rooms (`PG-103`, `PG-104`, `PG-301`, `PG-LAB-1`, `PG-LAB-2`) are reserved for MCA.
4. **Soft Preference Only:** Historical assignments from `backend/Daily TIME TABLE 2026  FINAL.xlsx` are modeled as solver preferences to guide room choices without locking down days, periods, or historical sequences.

---

## 2. Reconciled Section Hierarchy

### A. B.Sc. Computer Science (14 Sections Total)

| Programme Year | Academic Term / Semester | Section Identifier | Operational Shift | Source Grounding |
| :--- | :--- | :--- | :--- | :--- |
| **Year 1** | Odd (Semester 1) | **`I A`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 1** | Odd (Semester 1) | **`I B`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 1** | Odd (Semester 1) | **`I C`** | Shift 2 (13:00–17:45) | Historical Workbook & FLABS Workspace Map |
| **Year 2** | Odd (Semester 3) | **`II A`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 2** | Odd (Semester 3) | **`II B`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 2** | Odd (Semester 3) | **`II C`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 2** | Odd (Semester 3) | **`II D`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 2** | Odd (Semester 3) | **`II E`** | Shift 2 (13:00–17:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III A`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III B`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III C`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III D`** | Shift 1 (08:00–12:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III E`** | Shift 2 (13:00–17:45) | Historical Workbook & FLABS Workspace Map |
| **Year 3** | Odd (Semester 5) | **`III F`** | Shift 2 (13:00–17:45) | Historical Workbook & FLABS Workspace Map |

**Total Confirmed Sections for B.Sc. CS:** Exactly **14 sections** (3 in Year 1, 5 in Year 2, 6 in Year 3).

---

### B. MCA Regular (4 Sections Total — Excluding MCA Gen AI)

| Programme Year | Academic Term / Semester | Section Identifier | Operational Shift | Source Grounding |
| :--- | :--- | :--- | :--- | :--- |
| **Year 1** | Odd (Semester 1) | **`MCA I A`** | Shift 1 (08:00–12:45) | User Specification & FLABS Master Scope |
| **Year 1** | Odd (Semester 1) | **`MCA I B`** | Shift 1 (08:00–12:45) | User Specification & FLABS Master Scope |
| **Year 2** | Odd (Semester 3) | **`MCA II A`** | Shift 1 (08:00–12:45) | User Specification & FLABS Master Scope |
| **Year 2** | Odd (Semester 3) | **`MCA II B`** | Shift 1 (08:00–12:45) | User Specification & FLABS Master Scope |

**Total Confirmed Sections for MCA (Regular):** Exactly **4 sections** (2 in Year 1, 2 in Year 2).
*Note: MCA Gen AI sections are strictly excluded from this scope.*

---

## 3. Provisional Room Inventory & Block Isolation

### A. B.Sc. Computer Science (Block 5)

| Provisional Room Code | Display Name | Room Type | Building / Block | Historical Observed Frequency |
| :--- | :--- | :--- | :--- | :--- |
| `CR-200` | Classroom 200 | `CLASSROOM` | Block 5, 2nd Floor | Primary for I B, I C |
| `CR-204` | Classroom 204 | `CLASSROOM` | Block 5, 2nd Floor | Shared across I A, II A, III B, III E |
| `CR-205` | Classroom 205 | `CLASSROOM` | Block 5, 2nd Floor | Primary for II B, II E, III A |
| `CR-304` | Classroom 304 | `CLASSROOM` | Block 5, 3rd Floor | Shared across II A, II D, III C |
| `CR-305` | Classroom 305 | `CLASSROOM` | Block 5, 3rd Floor | Primary for II C, III D |
| `LAB-4FL` | 4th Floor Computer Lab | `PC_LAB` | Block 5, 4th Floor | Primary for all practical sessions |

### B. MCA Regular (PG Block)

| Provisional Room Code | Display Name | Room Type | Building / Block | Status |
| :--- | :--- | :--- | :--- | :--- |
| `PG-103` | PG Classroom 103 | `CLASSROOM` | PG Block, 1st Floor | Provisional (Capacity Unverified) |
| `PG-104` | PG Classroom 104 | `CLASSROOM` | PG Block, 1st Floor | Provisional (Capacity Unverified) |
| `PG-301` | PG Classroom 301 | `CLASSROOM` | PG Block, 3rd Floor | Provisional (Capacity Unverified) |
| `PG-LAB-1` | PG Computer Lab 1 | `PC_LAB` | PG Block | Provisional (Capacity Unverified) |
| `PG-LAB-2` | PG Computer Lab 2 | `PC_LAB` | PG Block | Provisional (Capacity Unverified) |

---

## 4. Section-to-Room Preference Mapping

| Programme | Section Identifier | Preferred Theory Room | Preferred Lab Room | Source Reference |
| :--- | :--- | :--- | :--- | :--- |
| B.Sc. CS | `I A` | `CR-204` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `I B` | `CR-200` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `I C` | `CR-200` | `LAB-4FL` | Historical Daily Timetable (Shift 2) |
| B.Sc. CS | `II A` | `CR-304` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `II B` | `CR-205` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `II C` | `CR-305` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `II D` | `CR-304` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `II E` | `CR-205` | `LAB-4FL` | Historical Daily Timetable (Shift 2) |
| B.Sc. CS | `III A` | `CR-205` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `III B` | `CR-204` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `III C` | `CR-304` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `III D` | `CR-305` | `LAB-4FL` | Historical Daily Timetable (Block 5) |
| B.Sc. CS | `III E` | `CR-204` | `LAB-4FL` | Historical Daily Timetable (Shift 2) |
| B.Sc. CS | `III F` | `CR-305` | `LAB-4FL` | Historical Daily Timetable (Shift 2) |
| MCA | `MCA I A` | `PG-103` | `PG-LAB-1` | User Confirmed PG Block List |
| MCA | `MCA I B` | `PG-104` | `PG-LAB-1` | User Confirmed PG Block List |
| MCA | `MCA II A` | `PG-301` | `PG-LAB-2` | User Confirmed PG Block List |
| MCA | `MCA II B` | `PG-103` | `PG-LAB-2` | User Confirmed PG Block List |

---

## 5. Intake Templates & Workflows

1. **Student Strength Collection Template:**
   - Saved at: `backend/templates/section_student_strength_collection_template.xlsx`
   - Populated with all 18 confirmed sections across B.Sc. CS and MCA. Student headcount cells are highlighted in soft yellow for HOD input.
2. **Preview Generation Service:**
   - Implemented at: `backend/app/services/provisional_timetable_preview_service.py`
   - Runs KAIROS under full hard-constraint rigor (faculty clash, section clash, room double-booking, daily teaching caps, theory repetition $\le 2$), bypassing only the unverified room capacity comparison.
   - Emits provisional schedules with disclaimer banner: `PROVISIONAL — CAPACITY NOT VERIFIED`.
