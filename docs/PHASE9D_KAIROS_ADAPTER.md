# Phase 9D: ERP to KAIROS Adapter

## Architecture
The adapter layer (`backend/scripts/run_simulation_solve.py`) is responsible for translating the canonical ERP representations into KAIROS solver structs without polluting the ERP layer with KAIROS dependencies. 

The adapter flow operates in three distinct phases:

### 1. Model Translation
- **Rooms**: Filtered by active status. `TimetableRoom.room_type` ("CLASSROOM", "PC_LAB") maps to KAIROS `Room.type` ("normal", "pc") and `is_lab`.
- **Instructors**: `FacultyProfile` mapped to KAIROS `Instructor` with string IDs.
- **Sections**: Created dynamically by grouping `TeachingSession` units by Section and Allocation.
- **Blocks**: Each `TeachingSession` maps 1:1 to a KAIROS `Block`, preserving the intrinsic duration (`length = duration_in_periods`).

### 2. Constraints & Blackouts
- ERP `TimetableFacultyAvailability` records with `UNAVAILABLE` status map to KAIROS `Config.instr_unavailable` (Day, Slot).

### 3. Execution via Pipeline
- The adapter does NOT invoke the raw CP-SAT builder directly. It uses the `src.timetabling.pipeline.run_pipeline` interface, providing resilience (auto-switching to solver repairs) and consistent reporting.

## Identity Strategy
- All KAIROS models receive string representations of ERP Postgres Integer IDs (e.g., `str(faculty.id)`).
- Blocks are uniquely identified by `TeachingSession.id`.

This decoupled mapping ensures that the Phase 1 business logic remains completely ignorant of KAIROS constraints.
