# Phase 9E.2 — Validator Design

The ERP Validator executes after KAIROS returns a candidate solution. It serves as an independent double-check boundary, preventing any KAIROS quirks or bugs from silently bypassing the domain rules.

## Comprehensive Checks

### 1. Booking Overlaps
Iterates through every `TimetableEntry` and verifies:
*   `assigned_faculty[(faculty_id, day)]`: No duplicate periods.
*   `assigned_sections[(section_id, day)]`: No duplicate periods. This specifically iterates through *all* involved sections for a teaching session (resolving `SynchronizedGroupMember` inclusions).
*   `assigned_rooms[(room_id, day)]`: No duplicate periods.

### 2. Room Rules
*   **Capacity:** Checks if `erp_room.capacity < total_students`. The `total_students` is carefully accumulated across all sections participating in the physical session.
*   **Suitability:** Asserts that theory sessions use `CLASSROOM` or `THEORY` type rooms, and lab sessions use `LAB`, `PC_LAB`, or `STUDIO`.

### 3. Availability Constraints
Checks every slot of the placement against the respective availability records (`TimetableFacultyAvailability`, `TimetableSectionAvailability`, `TimetableRoomAvailability`), throwing a violation if the status is `UNAVAILABLE`. The validator uses a dynamic `kairos_day_map` to map from ERP `day_index` to the solver's string day representation.

### 4. Period Contiguity
The validator analyzes multi-period blocks (like Labs) and traces their scheduled slots back to the ERP `TimetablePeriod` models. It asserts that for any adjacent slots `N` and `N+1`, `Period(N).end_time == Period(N+1).start_time`. This strictly enforces the "cannot cross a break" rule.

### 5. Expected vs. Scheduled Duration
The total duration of all generated placements must equal the total expected `duration_in_periods` across all teaching sessions belonging to the configuration. Any dropped session is treated as a fatal failure.

### 6. Synchronization
For each active `SynchronizedGroup`, the validator ensures that all associated sessions have exactly the same `day`, `start`, and `end` values in the final placement array.
