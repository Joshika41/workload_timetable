# PHASE 9B: DATABASE SCHEMA

This document describes the Phase 2 timetable data model structure. 

## 1. Core Architecture
The schema is designed to represent timetable entities independent of the Phase 1 workload allocation model, bridging them only through immutable foreign keys. The architecture cleanly separates configuration (Shifts, Periods, Days, Breaks), entity structures (Rooms, Availability, Constraints), and generative output (Runs, Versions, Entries).

## 2. Table Structures & Relationships

### Configurations
- **`timetable_configurations`**: Tracks logical grid profiles. Binds to `institution_id` and `workspace_id`.
- **`timetable_shifts`**: Defines blocks of the day (e.g., Shift 1: 08:00–12:45).
- **`timetable_working_days`**: Configures active days per configuration (e.g., Monday-Friday).
- **`timetable_periods`**: Individual schedulable timeslots. Linked to `timetable_configurations` and `timetable_shifts`.
- **`timetable_breaks`**: Represents hard exclusions in the configured day.

### Core Entities
- **`timetable_rooms`**: Unified room inventory. Contains `room_type`, `capacity`, and `metadata_json` for suitability constraints.
- **Availability Tables (`timetable_faculty_availability`, `timetable_section_availability`, `timetable_room_availability`)**: Explicit availability state map (AVAILABLE vs UNAVAILABLE) indexed by day and period.
- **`timetable_constraints`**: Normalized table for HARD, SOFT, CONFIGURABLE rules affecting the solver logic.

### Bridge Entity: Teaching Sessions
- **`teaching_sessions`**: The pivotal table. It derives strictly from `FINALIZED_ALLOCATION` via `allocation_id` (FK to `subject_allocations`). It asserts `duration_in_periods` explicitly for accurate Lab blocking. 

### Synchronization
- **`synchronized_groups`** & **`synchronized_group_members`**: Enables first-class support for electives and mixed sections. By grouping `teaching_sessions` into a `synchronized_group`, the solver knows to map them to the exact same temporal footprint despite differing rooms/instructors.

### Generation & Publishing
- **`timetable_runs`**: Represents a single execution of the KAIROS adapter/solver. Tracks status (QUEUED, RUNNING, COMPLETED, FAILED) and diagnostics.
- **`timetable_versions`**: Belongs to a run. Manages the lifecycle (DRAFT, VALIDATED, PUBLISHED, SUPERSEDED).
- **`timetable_entries`**: The canonical scheduled output. Links `teaching_session`, `faculty`, `section`, `room`, `day_index`, and `start_period`. Fully indexed to serve Class, Faculty, and Room UI views from a single dataset.

## 3. Database Safety & Integrity
- All references to Phase 1 data (Workspace, Programme, Allocation, Section) are strictly enforced via Foreign Keys.
- Timestamps and versioning enums prevent overwriting of historical data. No `ON DELETE CASCADE` is set for generative output relative to source allocation, preserving historical traceability even if allocations change.
