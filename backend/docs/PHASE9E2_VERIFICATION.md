# Phase 9E.2 — Core Hard Constraint Verification

This document confirms the regression and intentional invalidation test results for the core hard constraints implemented in Phase 9E.2. 

## Testing Methodology
All tests are completely contained within the isolated `test_sim_<scenario>.db` sqlite databases generated dynamically from the Simulation Seeder. Production data remains explicitly blocked and untouched.
Each scenario seeds the database, mutates the state to intentionally trigger a constraint, executes the pipeline, and validates whether the Engine and ERP Validator appropriately caught the issue.

## 1. Intentional Invalidation Tests

### 1.1 Room Capacity Failure
*   **Action:** Reduced all available room capacities to `30`. The primary section (`MCA-A`) requires a capacity of `60`.
*   **Result:** `INFEASIBLE`. The CP-SAT solver correctly rejected all placement candidates for the physical sessions because no room in the feasible set had sufficient capacity.

### 1.2 Room Suitability (Lab Requirement)
*   **Action:** Changed all `TimetableRoom` configurations to `CLASSROOM` type. The dataset contains a Lab session (`CS102`) that requires a `LAB`, `PC_LAB`, or `STUDIO` room.
*   **Result:** `INFEASIBLE`. The adapter's `feasible_rooms_for` logic successfully filtered out all ordinary classrooms for the lab session, leading to an empty candidate list and an immediate solver failure.

### 1.3 Faculty Availability Blackout
*   **Action:** Set `TimetableFacultyAvailability` for the primary CS faculty member to `UNAVAILABLE` across all 6 periods for all active working days.
*   **Result:** `INFEASIBLE`. The solver correctly respected the `instr_unavailable` list passed via `Config`, recognizing that the faculty's sessions had zero valid slots remaining.

### 1.4 Section Availability Blackout
*   **Action:** Set `TimetableSectionAvailability` for `MCA-A` to `UNAVAILABLE` across all periods.
*   **Result:** `INFEASIBLE`. The custom `section_unavailable` constraint added to the adapter successfully pruned candidate slots, proving the engine respects cohort-level hard closures.

### 1.5 Room Availability Blackout
*   **Action:** Set `TimetableRoomAvailability` for all physical rooms to `UNAVAILABLE` for all periods.
*   **Result:** `INFEASIBLE`. The engine accurately rejected room placements using the newly mapped `room_unavailable` frozenset.

## 2. Feasible Regression Checks

*   **Action:** Executed the complete unchanged Phase 9E.1 seed database.
*   **Result:** `COMPLETED`.
*   **Validation Passing Criteria:**
    *   **0 Violations** reported by the independent ERP Validator.
    *   **Synchronization intact:** The 3-member elective group was locked to a single identical start slot.
    *   **Mixed Sections intact:** Cohort collision logic preserved the shared theory hour.
    *   **Contiguity preserved:** Lab blocks did not stride the 10:15–10:30 break.
    *   **Duration equality:** The scheduled block durations exactly matched the original allocation expected durations.

Phase 9E.2 Verification is fully validated and successfully closed.
