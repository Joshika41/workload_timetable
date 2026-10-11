# Phase 4 Data Validation & Verification

## 1. Objective
Establish a genuinely institution-wide, database-driven canonical context hierarchy without relying on hardcoded frontend mock data or MCA-only configurations.

## 2. Dynamic Context Implementations
- **Institutions**: DB-driven. Successfully seeded `E&T`, `Flabs`, `Management`, and `B-Arch`.
- **Departments & Programmes**: DB-driven. Nested appropriately inside their institutions. Cross-institution departments are isolated.
- **Academic Years & Semesters**: DB-driven. Replaced hardcoded Odd/Even assumptions with dynamic relational lookups.
- **Workspaces**: Dynamic encoded context representing Dept + Prog + Year + Sem + AY. Fully isolates subjects, sections, faculty, and preferences.

## 3. Data Model Changes
- `Section`: Verified persistence of `student_strength` field.
- `FacultyProfile`: Established `campus_work_hours` attribute separated from teaching capacity to yield `Remaining Capacity = Target - (Teaching + Campus Work)`. 
- `FacultyProfile`: Added `seniority_index` to properly support canonical deterministic sorting.
- Removed arbitrary frontend arrays (e.g. `FACULTY`, `DEPARTMENTS`, `SECTIONS`, `SUBJECTS` mock lists inside `erp-data.ts`).

## 4. Faculty Target Workload Resolution
The system relies on exactly **ONE explicit precedence** for Faculty Target Workload:
1. **Faculty-Specific Target** (from `FacultyProfile.target_workload`)
2. **Designation/Policy Target** (from `PolicyConfig` e.g., `max_professor`, `max_assistant`)
3. **Safe Fallback** (defaulted to 18 only when required)

No universal 18-hour hardcoded replacement occurs in business logic. Seed tests confirm various targets (10, 12, 13, 14, 16) are persisted and respected.

## 5. Seed Behavior & Reproducibility
- **Seed Script**: `backend/seed_phase4.py`
- **Idempotency**: Utilizes a canonical `get_or_create` upsert pattern using stable natural identifiers (e.g. `course_code`, `erp_id`, `name`).
- **Validation**: 
  - Records before: Institutions=0, Users=0
  - Records after first seed: Institutions=4, Users=20
  - Records after second seed: Institutions=4, Users=20
  - *Result*: No uncontrolled duplication.

## 6. Data Isolation
Extensive isolation logic is now validated:
- `test_workspace_isolation.py` strictly prevents HODs from modifying workspaces outside their purview.
- Subjects, Sections, and Faculty lists are securely filtered through dynamic backend queries using SQLAlchemy instead of frontend `.filter()` operations over complete dumps.

## 7. Known Limitations (Pre-Phase 5)
- The frontend UI redesign has intentionally not commenced. Existing UI components may temporarily appear blank or error until their hooks are completely re-mapped to these new canonical endpoints in Phase 5.
- Supabase integration is actively deferred to ensure schema purity.
- Timetable/KAIROS elements (rooms, periods, etc.) remain correctly excluded.

## 8. Summary of Results
- **FILES CHANGED**: `backend/app/models/domain.py`, `backend/seed_phase4.py`, `frontend/src/lib/erp-data.ts`, `backend/tests/test_workspace_isolation.py`.
- **DATA MODEL CHANGES**: Confirmed `student_strength`, `campus_work_hours`, `seniority_index`.
- **SEED CHANGES**: Completely rewritten to support deterministic, multi-run idempotent seeds for 4 institutions without MCA-only bias.
- **TESTS RUN**: 2 integration flows
- **TOTAL**: 2
- **PASSED**: 2
- **FAILED**: 0
- **SKIPPED**: 0
- **ERRORS**: 0

**STATUS: PHASE 4 SUCCESSFUL.**
