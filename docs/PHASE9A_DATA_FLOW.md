# PHASE 9A: DATA FLOW

The entire Timetable generation architecture relies on a unidirectional data flow that separates the ERP state from the KAIROS Solver execution.

## 1. System Pipeline
`SUPABASE` 
    ↓ 
`FINALIZED ALLOCATIONS` (Source of Truth)
    ↓ 
`TEACHING SESSION BUILDER` (Splits workload hours into individual `TeachingSession` units)
    ↓ 
`TIMETABLE INPUT MODEL` (Internal ERP schema mapping available rooms, sessions, and availability)
    ↓ 
`KAIROS ADAPTER` (Translates the Input Model into pure integer-based OR-Tools DTOs)
    ↓ 
`KAIROS / CP-SAT ENGINE` (Executes solving logic against Constraints)
    ↓ 
`KAIROS OUTPUT` (Raw list of time and space assignments)
    ↓ 
`ERP TIMETABLE VALIDATOR` (Independent check ensuring NO hard constraints were violated)
    ↓ 
`TIMETABLE ENTRIES` (Persisted to database tied to a `TimetableVersion`)
    ↓ 
`CLASS VIEW + FACULTY VIEW + ROOM VIEW` (UI renders the entries)

## 2. Validator Boundary (Clarification)
KAIROS output is **never** trusted blindly. 
The `ERP TIMETABLE VALIDATOR` acts as an absolute boundary. It will receive the KAIROS output and run independent programmatic assertions against the ERP representation. 

The validator must NOT merely trust the solver's internal status (e.g. `OPTIMAL` or `FEASIBLE`). It must explicitly check:
* Did KAIROS place all `TeachingSessions`?
* Are there any room double-bookings in the ERP representation?
* Are there any faculty double-bookings in the ERP representation?
* Were ERP availability rules bypassed?
* Were synchronization groups (same day, same start period, same duration) perfectly honored?

Only if the ERP Validator passes these Hard Constraints will the `TimetableRun` transition to `COMPLETED` and generate entries.

## 3. Manual Editing Workflow
When an authorized HOD/Admin attempts to manually tweak a generated timetable via the UI:
1. The manual edit is submitted.
2. The change is intercepted by the `ERP TIMETABLE VALIDATOR`.
3. If the change violates a Hard Constraint (e.g. moving a class to a slot where the faculty is double-booked), the edit is **rejected**.
4. If valid, the edit is accepted and a new `TimetableVersion` may be cut.
Manual edits can never bypass hard constraints.
