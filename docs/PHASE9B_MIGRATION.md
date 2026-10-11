# PHASE 9B: MIGRATION STRATEGY

## 1. Strategy
The migration strategy is purely additive. The Phase 2 Timetable foundation must be constructed without modifying, dropping, or rewriting any existing Phase 1 schema rules (e.g., preference workflows, workload allocation logic).

## 2. Alembic Migration
A single alembic migration file was generated using `--autogenerate` referencing the newly created `timetable.py` declarative models.
- **Migration ID**: `18aedd9497d3_add_timetable_models.py` (or equivalent current head).

## 3. Constraints & Foreign Keys
The migration safely injects foreign keys pointing backwards into the Phase 1 tables:
- `timetable_configurations.workspace_id` → `academic_workspaces.id`
- `teaching_sessions.allocation_id` → `subject_allocations.id`
- `teaching_sessions.faculty_id` → `faculty_profiles.id`
- `teaching_sessions.section_id` → `sections.id`

No constraints were added that would accidentally prevent valid configurations (e.g. no unique composite constraints on timeslots, leaving conflict prevention to the application's Validator layer).

## 4. Lifecycle & Historical Behavior
No `ON DELETE CASCADE` behaviors were configured that would wipe generated `timetable_runs` or `timetable_versions` if the underlying workload data is removed. Soft-delete or RESTRICT behaviors are standard, preserving institutional auditability.

## 5. Post-Migration State
- All Phase 1 records remain unchanged (0 rows modified).
- Zero (0) fake simulation rows were created for sections, availability, teaching sessions, or timetable entries. Current FLABS section count remains strictly 0.
