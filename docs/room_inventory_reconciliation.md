# Room Inventory Reconciliation Report: Historical vs Canonical ERP

## 1. Executive Summary

This document reconciles historical timetable room notations observed in operational spreadsheets (principally `backend/Daily TIME TABLE 2026  FINAL.xlsx`) against the canonical database requirements of the university ERP timetable engine (`timetable_rooms`).

As confirmed in previous architectural audits, **`timetable_rooms` currently contains 0 records in Mumbai PostgreSQL**. The solver engine and canonical preflight checks (`run_timetable_preflight_checks`) intentionally enforce that unverified rooms or missing capacities block timetable generation (HTTP 422).

This report establishes:
1. Every room code and label observed in historical timetable rosters.
2. The data gaps (capacities, lab equipment, shift sharing) that must be verified by the institution.
3. The exact authoritative intake workflow via `official_timetable_room_inventory_template.xlsx` and `import_official_room_inventory.py`.

---

## 2. Historical Room References Observed

The spreadsheet `backend/Daily TIME TABLE 2026  FINAL.xlsx` records operational schedules across FLABS Block 5 (B5) with the following room notations:

| Observed Historical Notation | Inferred Room Type | Physical Location / Block | Observed Course / Subject Examples | Recorded Capacity in Excel |
| :--- | :--- | :--- | :--- | :--- |
| **`200`** | Classroom | Block 5, 2nd Floor | English, Tamil, Maths | **None** (Not recorded) |
| **`204`** | Classroom | Block 5, 2nd Floor | Problem Solving in Python (PSP), Digital Electronics (DE), DBMS | **None** (Not recorded) |
| **`205`** | Classroom | Block 5, 2nd Floor | Operating Systems (OS), Discrete Maths (DM), Minor Electives | **None** (Not recorded) |
| **`304`** | Classroom | Block 5, 3rd Floor | DBMS, Operating Systems, Maths | **None** (Not recorded) |
| **`305`** | Classroom | Block 5, 3rd Floor | Discrete Maths, Maths, DBMS | **None** (Not recorded) |
| **`4th Floor Lab`** / **`LAB 4TH FLOOR LAB`** | Computer Lab (`PC_LAB`) | Block 5, 4th Floor | OS Lab, Python Programming Lab | **None** (Not recorded) |

> [!WARNING]
> Historical timetables used informal room notations without recorded seating capacities, desk layouts, or lab workstation counts. Treating historical room codes as "proof of availability" without verified physical capacities would violate solver room constraints.

---

## 3. Discrepancy & Verification Analysis

### A. Seating Capacity Gap
- **Requirement:** Canonical ERP model `timetable_rooms.capacity` is a non-null integer. KAIROS enforces hard room capacity: $\text{room.capacity} \ge \text{section.student\_strength}$.
- **Status:** Neither `Daily TIME TABLE 2026  FINAL.xlsx` nor master workload files provide room desk counts.
- **Action Required:** Estate / Campus Administration must supply verified student desk counts for rooms `200`, `204`, `205`, `304`, `305`, and workstation counts for `4th Floor Lab`.

### B. Specialized Lab Classification
- **Requirement:** `timetable_rooms.lab_classification` (e.g., `COMPUTER_SCIENCE`, `ELECTRONICS`, `PHYSICS`, `DATA_SCIENCE`).
- **Status:** `4th Floor Lab` is referenced for both Operating Systems and Python. It must be formally classified in ERP as `PC_LAB` with lab classification `COMPUTER_SCIENCE`.

### C. Cross-Department & Cross-Shift Sharing
- **Requirement:** Timetables must coordinate room availability across departments and shifts.
- **Status:** In the historical schedule, room `205` is shared between Shift 1 (`II B`) and Shift 2 (`II E`). Our Phase 5.2/5.3 actual-time overlap checks now ensure that cross-shift sharing of `205` is mathematically protected from double-booking.

---

## 4. Reconciliation Table & Import Action Plan

| Canonical Room Code | Proposed Display Name | Canonical `room_type` | Location | Current Status | Required Action Before Import |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CR-200` | Classroom 200 | `CLASSROOM` | Block 5, 2nd Floor | Unverified | Confirm exact capacity (e.g., 60 seats) |
| `CR-204` | Classroom 204 | `CLASSROOM` | Block 5, 2nd Floor | Unverified | Confirm exact capacity (e.g., 60 seats) |
| `CR-205` | Classroom 205 | `CLASSROOM` | Block 5, 2nd Floor | Unverified | Confirm exact capacity & Shift 2 sharing |
| `CR-304` | Classroom 304 | `CLASSROOM` | Block 5, 3rd Floor | Unverified | Confirm exact capacity (e.g., 60 seats) |
| `CR-305` | Classroom 305 | `CLASSROOM` | Block 5, 3rd Floor | Unverified | Confirm exact capacity (e.g., 60 seats) |
| `LAB-4FL` | 4th Floor Computer Lab | `PC_LAB` | Block 5, 4th Floor | Unverified | Confirm PC workstation count (e.g., 70 PCs) |

---

## 5. Authoritative Intake Workflow

To safely ingest verified rooms into Mumbai PostgreSQL when approved:
1. **Fill Template:** Fill `backend/templates/official_timetable_room_inventory_template.xlsx` with verified capacities, setting `Approval Status = APPROVED` and `Verification Status = VERIFIED`.
2. **Dry-Run Validation:**
   ```bash
   python backend/scripts/import_official_room_inventory.py backend/templates/official_timetable_room_inventory_template.xlsx
   ```
3. **Formal Ingestion (Only when authorized by user):**
   ```bash
   python backend/scripts/import_official_room_inventory.py backend/templates/official_timetable_room_inventory_template.xlsx --apply
   ```
4. **Readiness Check:**
   ```bash
   python backend/scripts/report_timetable_readiness.py --institution-id 2
   ```
