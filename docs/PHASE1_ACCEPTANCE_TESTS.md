# SRM University Workload ERP - Phase 1 Acceptance Tests

This document defines the acceptance tests required for the final Phase 1 sign-off.
For every requirement, the status and evidence must be recorded.

---

### Requirement: Four Institutions Support
**STATUS**: FAIL
**Evidence**: Backend data heavily relies on hardcoded seeds or lacks comprehensive CRUD endpoints.
**Location**: `backend/app/routers/academic.py`, `seed_users.py`
**Problem**: Hardcoded seeding bypasses dynamic validation.
**Required Repair**: Implement full database-driven CRUD operations for Institution models.
**Test**: Verify UI allows creating and selecting 4 dynamic institutions.

### Requirement: Multiple Departments & Programmes
**STATUS**: PARTIAL
**Evidence**: Models exist and are used in `seed_users.py`.
**Location**: `backend/app/models/domain.py`
**Problem**: Heavy reliance on mock data rather than robust admin workflows.
**Required Repair**: Verify department and programme cascading selection without hardcoding.
**Test**: Create new Department and Programme and assign Faculty to it successfully.

### Requirement: Dynamic Academic Context
**STATUS**: PARTIAL
**Evidence**: `AcademicWorkspace` model implemented, but legacy code ignores it.
**Location**: `backend/routers/`, `frontend/src/routes/`
**Problem**: Legacy routes attempt allocation without workspace context validation.
**Required Repair**: Delete legacy routers and strictly enforce `verify_workspace_access()`.
**Test**: Attempt allocation via legacy API to ensure it is unreachable.

### Requirement: Faculty filtering by institution/role
**STATUS**: PASS
**Evidence**: Correctly implemented in `GET /api/auth/profiles`.
**Location**: `backend/app/routers/auth.py`
**Problem**: None observed.
**Required Repair**: N/A
**Test**: Login dropdown strictly filters faculty vs HOD per institution.

### Requirement: Seniority-based faculty ordering
**STATUS**: FAIL
**Evidence**: API returns faculty arrays without explicit `ORDER BY seniority_index` or similar logical sorting.
**Location**: `backend/app/routers/faculty.py`
**Problem**: Faculty lists render in unpredictable insertion order.
**Required Repair**: Enforce sorting by Designation hierarchy on `getHODFacultyList`.
**Test**: Validate HOD dashboard orders Dean -> HOD -> Professor -> Assistant Professor.

### Requirement: Core + Elective rule
**STATUS**: PARTIAL
**Evidence**: Validation exists in `PreferenceManagement.tsx` but is duplicated and fragile.
**Location**: `frontend/src/components/workload/PreferenceManagement.tsx`
**Problem**: Legacy React components duplicate this logic, and it lacks backend enforcement.
**Required Repair**: Consolidate frontend check into `pages/` and enforce rule on backend `POST`.
**Test**: Submit preferences with 0 Core subjects -> Expected: Error.

### Requirement: Class Coordinator Core requirement
**STATUS**: FAIL
**Evidence**: No specific flag or validation rule exists linking Class Coordinator status to class-type Core subject selection.
**Location**: `backend/app/services/preference_service.py`
**Problem**: Completely missing feature.
**Required Repair**: Add `class_coordinator_for` to `FacultyProfile` and validate during preference submission.
**Test**: Faculty (Coordinator for MCA GEN AI) submits preferences without GEN AI Core subject -> Expected: Error.

### Requirement: Optional Minor / Multidisciplinary
**STATUS**: FAIL
**Evidence**: Not properly decoupled from the Core/Elective counting logic.
**Location**: `frontend/src/pages/faculty/FacultyWorkloadShell.tsx`
**Problem**: Selecting a Minor course erroneously counts towards Core/Elective requirements or is disabled incorrectly.
**Required Repair**: Exclude Minor/Multidisciplinary categories from Core/Elective lockouts.
**Test**: Select 1 Core, 1 Elective -> Minor course remains selectable.

### Requirement: Disabling additional Core/Elective after required selection
**STATUS**: PARTIAL
**Evidence**: Client-side logic exists but is easily bypassed and duplicated.
**Location**: `frontend/src/pages/faculty/PreferenceManagement.tsx`
**Problem**: Legacy components confuse the state.
**Required Repair**: Remove legacy components and strictly bind disable state to `(core_selected > 0 && elective_selected > 0)`.
**Test**: Verify checkboxes for extra Core subjects become disabled upon valid selection.

### Requirement: Faculty preference submission
**STATUS**: PASS
**Evidence**: Fully mapped in `PreferenceSubmission` and `PreferenceItem` models.
**Location**: `backend/app/routers/preferences.py`
**Problem**: Duplicate logic in `backend/routers/preferences.py`.
**Required Repair**: Delete legacy backend preferences router.
**Test**: Submit valid preferences and retrieve them in HOD dashboard.

### Requirement: Incharge-1 / Incharge-2 Role Assignment
**STATUS**: FAIL
**Evidence**: The database enum correctly states `Incharge-1` and `Incharge-2`, but backend processing strictly checks for legacy strings `"MAIN"` and `"ASSISTANT"`.
**Location**: `backend/app/services/workload_service.py`, `backend/old_database.py`
**Problem**: Disconnect between DB Enums and Service layer hardcodes.
**Required Repair**: Globally replace all instances of "MAIN" and "ASSISTANT" with `AllocationRoleEnum.INCHARGE_1`.
**Test**: Allocate a faculty as Incharge-2 and verify Workload calculation correctly interprets it.

### Requirement: Section Allocation
**STATUS**: FAIL
**Evidence**: `sqlite3.IntegrityError: NOT NULL constraint failed: sections.workspace_id`.
**Location**: `backend/app/models/domain.py` vs `backend/tests/test_workspace_isolation.py`
**Problem**: Section creation lacks `workspace_id` in test fixtures, indicating a broken DB migration state or disconnected seeding.
**Required Repair**: Fix seed scripts and tests to properly assign `workspace_id` to Sections.
**Test**: Pass `test_workspace_isolation.py`.

### Requirement: Automatic Total (Theory + Lab)
**STATUS**: PARTIAL
**Evidence**: Works on frontend table visually but backend `total_hours` calculation in services relies on legacy variables (`main_faculty`).
**Location**: `backend/app/services/workload_service.py`
**Problem**: Backend workload generation duplicates addition logic incorrectly.
**Required Repair**: Centralize calculation: `theory_hours + lab_hours`.
**Test**: Allocate 3 Theory + 2 Lab -> Finalized Workload table strictly displays 5.

### Requirement: Faculty Workload Hour Cap Validation
**STATUS**: PARTIAL
**Evidence**: Some basic logic exists but fails when testing edge cases (e.g., cross-department allocation).
**Location**: `backend/app/services/allocation_service.py`
**Problem**: Not reliably enforced at the database transaction level.
**Required Repair**: Backend must hard-reject any allocation transaction exceeding designation cap.
**Test**: Attempt allocation of 20 hours to Assistant Professor (Cap 16) -> Expected: HTTP 400.

### Requirement: Finalization & PDF Export
**STATUS**: PARTIAL
**Evidence**: Route `/api/workload/finalize/department` works but duplicates exist in `academicApi`.
**Location**: `backend/app/routers/workload.py`
**Problem**: Dual API surfaces for the exact same action.
**Required Repair**: Remove `/api/workload/finalize/department` and standardize on workspace finalization.
**Test**: Export PDF and verify it exclusively contains finalized allocations (no mock data).
