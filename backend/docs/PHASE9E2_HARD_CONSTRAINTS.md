# Phase 9E.2 — Core Hard Constraint Engine

This document outlines the hard constraints implemented in Phase 9E.2 of the timetabling module. The solver engine (`KAIROS`) natively supports many CP-SAT constraints, and the ERP Adapter sets them up appropriately.

## 1. Source of Truth
The source of truth remains the `FINALIZED` allocation data. The solver treats the allocation blocks as immutable facts. 
*   **Immutability:** The solver will not alter theory hours, practical/lab hours, faculty assignment, section assignment, or subject assignment. If an allocation is impossible to schedule, the solver returns `INFEASIBLE` with diagnostic details instead of corrupting the upstream workload.

## 2. Hard Constraints

### Capacity and Suitability
*   **Room Capacity:** A room's `capacity` must be `>=` the `student_strength` of the assigned section(s). For mixed-section cohorts, the sum of all participating sections' strengths is evaluated. 
*   **Room Suitability:** Lab sessions (`teaching_type == "LAB"`) can only be placed in `LAB`, `PC_LAB`, or `STUDIO` room types. Theory sessions (`teaching_type == "THEORY"`) can only be placed in `CLASSROOM` or `THEORY` room types.

### Overlap and Booking
*   **Faculty Double Booking:** A faculty member cannot teach more than one session in the same day and period.
*   **Section Double Booking:** A student section (including all cohorts in mixed sessions) cannot have more than one session at the same time.
*   **Room Double Booking:** A physical room cannot host multiple independent sessions at the same time.

### Availability
*   **Faculty Availability:** Sessions will not be scheduled when a faculty member's `TimetableFacultyAvailability` status is `UNAVAILABLE`.
*   **Section Availability:** Sections will not be scheduled during their specific `UNAVAILABLE` slots.
*   **Room Availability:** Rooms will not be utilized when their status is `UNAVAILABLE`.

### Valid Periods and Working Days
*   **Working Days:** Sessions are strictly limited to the active working days defined in the `TimetableWorkingDay` settings (e.g., excluding Saturdays unless explicitly enabled).
*   **Contiguity & Protected Break:** Multi-period blocks (like 2-hour labs) must be contiguous. The adapter evaluates the `TimetablePeriod` configurations to identify break periods. A contiguous session block cannot straddle a protected break.

### Synchronization
*   All Phase 9E.1 synchronization rules remain authoritative: Synchronized group members are mathematically bound to the same start day, slot, and duration.

### Required Teaching Hours
*   The final expected teaching duration derived from the allocation is verified against the actually placed blocks. Any unplaced sessions trigger a validation failure.
