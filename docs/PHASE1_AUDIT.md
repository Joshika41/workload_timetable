# SRM University Workload ERP - Phase 1 Repository Audit

## 1. Current Repository Architecture
The repository is currently in a fragmented, mixed-architecture state. It contains parallel sets of frontend directories and backend routers, indicating an incomplete migration from an older monolithic implementation (Phase 0) to a modular, role-based, context-aware implementation (Phase 1).

## 2. Active Frontend
- **Entry Point**: `frontend/src/App.tsx` and `frontend/src/main.tsx`
- **Location**: `frontend/src/pages/` (e.g., `ContextSelection.tsx`, `hod/`, `faculty/`)
- **Routing Engine**: React Router DOM
- **Characteristics**: Uses contextual wrappers (`FacultyWorkloadShell.tsx`, `HODWorkloadShell.tsx`) and dynamic contexts (session contexts). 

## 3. Active Backend
- **Entry Point**: `backend/app/main.py`
- **Location**: `backend/app/routers/` and `backend/app/services/`
- **Characteristics**: Modular FastAPI implementation separating `auth`, `academic`, `faculty`, `preferences`, `allocation`, and `workload`.

## 4. Legacy Frontend
- **Location**: `frontend/src/routes/` (e.g., `admin.allocation.tsx`, `faculty.dashboard.tsx`) and `frontend/src/components/workload/`
- **Characteristics**: Abandoned file-based routing components and duplicate monolithic components still lingering in the build context.

## 5. Legacy Backend
- **Location**: `backend/main.py` (Monolithic FastAPI file, 30KB+) and `backend/routers/` (Old monolithic logic).
- **Characteristics**: Hardcodes rules, uses legacy role strings (`MAIN`), and lacks modern workspace context isolation.

## 6. Database Architecture
- **Engine**: SQLite (`erp_local.db`) via SQLAlchemy.
- **Models**: Located in `backend/app/models/domain.py`.
- **Integrity**: Contains robust models for `Institution`, `Department`, `Programme`, `AcademicWorkspace`, `CurriculumOffering`, `Section`, `SubjectAllocation`, etc. However, test fixtures do not align with current NOT NULL constraints (e.g., `sections.workspace_id`).

## 7. Current API Map (Active)
- `GET /api/auth/profiles`
- `POST /api/auth/login`
- `GET /api/institutions`
- `GET /api/faculty/my-semesters`
- `POST /api/faculty/preferences/submit`
- `GET /api/faculty/hod`
- `GET /api/workspaces-by-context`
- `POST /api/workload/finalize/department`
- `GET /api/workload/export.pdf`

## 8. Current Workflow Map
1. **LOGIN**: HOD/Faculty -> Institution -> Profile -> `POST /api/auth/login`
2. **FACULTY**: View `my-semesters` -> Filter Subjects -> Submit Preferences -> `POST /api/faculty/preferences/submit`
3. **HOD**: View `faculty/hod` -> Review Preferences -> Allocate Section & Role -> `POST /api/allocations` -> Verify Caps -> `POST /workload/finalize`
4. **PDF**: `GET /workload/export.pdf` (Triggered post-finalization).

## 9. Business Rule Audit (Pass/Fail)
- **Four institutions**: PARTIAL (Models exist, but heavily relies on `seed_users.py` mock data).
- **Dynamic academic context**: PARTIAL (Workspaces exist but logic tangles between old/new).
- **Faculty filtering by institution/role**: PASS
- **Seniority-based ordering**: FAIL (Not consistently applied in API responses).
- **Core + Elective rule**: PARTIAL (Logic exists but buggy/duplicate in frontend).
- **Class Coordinator Core requirement**: FAIL (Not implemented).
- **Optional Minor/Multidisciplinary**: FAIL (Not properly decoupled from Core/Elective counters).
- **Incharge-1 / Incharge-2**: PARTIAL (DB Enum uses `Incharge-1` and `Incharge-2`, but legacy `MAIN` / `ASSISTANT` hardcodes remain in `workload_service.py`).
- **Faculty workload hour cap**: PARTIAL (Validation exists but is fragile).
- **Finalized workload**: PARTIAL (Finalization lock works, but duplicate routes exist).

## 10. Frontend/Backend Contract Audit
Mismatches exist due to duplicate logic. Frontend pages call `academicApi.finalizeWorkspace` while legacy routes call `/workload/finalize/department`. This results in state inconsistency.

## 11. Database Problems
- Migrations (`alembic`) exist, but the SQLite schema includes NOT NULL constraints (`workspace_id` in `sections`) that break existing tests and seed scripts.

## 12. Duplicate Logic (CRITICAL)
- **Workload Finalization**: Logic is duplicated across `allocation_service.py`, `workload.py`, `academic.py`, `allocation.py` in the backend, and multiple frontend components.
- **PDF Generation**: Logic exists in `pdf_service.py` and old monolithic blocks.
- **Preference Submission**: Old `backend/routers/preferences.py` vs new `backend/app/routers/preferences.py`.

## 13. Hardcoded Data
- Legacy roles (`"MAIN"`, `"ASSISTANT"`, `"IN-2"`) scattered throughout `workload_service.py` and `old_database.py`.
- `main_faculty` variables are hardcoded in workload calculators.

## 14. Mock Data
- Fake test data is heavily injected via `seed_users.py`, `seed_faculty.py`, `seed_demo.py`, bypassing standard CRUD endpoints.

## 15. Security/Authorization Problems
- `CORSMiddleware` allows all origins (`*`).
- Authorization is rudimentary (`workspace_auth.py`), but legacy routes bypass context-level security entirely.

## 16. Test Failures
- **Backend Tests**: `pytest` fails immediately. `tests/test_workspace_isolation.py` fails with `sqlite3.IntegrityError: NOT NULL constraint failed: sections.workspace_id`.
- **Frontend Checks**: `tsc --noEmit` fails with 39 errors, primarily TypeErrors in `src/pages/hod/PreferenceManagement.tsx` and legacy routing files.

## 17. Critical Defects
- **The Dual-State Engine**: The app can easily crash or corrupt data if a user hits a legacy route instead of an active page, due to mismatched API payloads and role names (e.g., `MAIN` vs `Incharge-1`).
- **TypeScript Breakage**: Large portions of the frontend codebase are uncompilable in strict mode.

## 18. Recommended Architecture
1. Completely eradicate the `frontend/src/routes/` and `frontend/src/components/workload/` legacy directories.
2. Completely eradicate the `backend/routers/` legacy directory and `backend/main.py` monolith.
3. Consolidate finalization logic into a single atomic transactional service method (`workload_service.finalize`).
4. Replace all instances of `MAIN`/`ASSISTANT` string literals with the `AllocationRoleEnum.INCHARGE_1` / `INCHARGE_2`.

## 19. Exact Repair Order
1. **Cleanup**: Delete all identified legacy directories and files (frontend routes, backend old routers, main.py).
2. **Database Alignment**: Fix test fixtures and seed data to respect `workspace_id` NOT NULL constraints.
3. **Role Normalization**: Refactor `workload_service.py` and allocation schemas to strictly use `Incharge-1` and `Incharge-2`.
4. **Logic Consolidation**: Centralize Workload Finalization logic.
5. **Business Rules**: Implement the missing Class Coordinator Core rule and decouple Optional Minor courses.
6. **Testing**: Repair TypeScript definitions and fix backend unit tests to PASS.
