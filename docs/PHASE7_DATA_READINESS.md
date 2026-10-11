# Phase 7: Data Readiness & Hardening

## Overview
Phase 7 focuses strictly on hardening the Phase 1 ERP implementation and guaranteeing data integrity for the real-world dataset (FLABS). No timetable generation or scheduling code has been implemented in this phase.

## Current Real-Data Coverage
- **Institutions**: Explicitly limited to the 4 canonical institutions: E&T, Flabs, Management, B-Arch. No duplicate "FLABS" vs "Flabs" entries exist in the canonical source.
- **Departments & Programmes**: Standardized.
- **Faculty Data**: Real FLABS faculty list imported. Shift-2 and FTS faculty are cleanly isolated and excluded from the active working set.
- **Curriculum Offerings**: Correctly mapped.
- **Sections**: Currently **0** for FLABS. The system embraces this state by rendering an intentional "No section data is currently available" empty-state UI component instead of crashing or generating fake data.

## Known Data Gaps
- FLABS sections have not yet been provided by the institution. Final subject allocation to actual students cannot proceed until this data is supplied.
- Semester 7 & 8 are currently excluded for FLABS UG per Phase 4 rules. 

## Import Rules
1. Never fabricate fake sections or students.
2. Canonical Excel staging remains the sole source of truth for base structured data. 
3. The frontend must only request data via the FastAPI gateway; direct Excel parsing is strictly forbidden.
4. FLABS-specific dataset exclusions (e.g., FTS exclusion) apply only to the FLABS import batch, not globally across the entire ERP.

## Validation Rules
- **Foreign Keys**: Enforced unconditionally on the DB schema.
- **Role Normalization**: Only `INCHARGE_1` and `INCHARGE_2` roles are permitted. All references to legacy `MAIN`, `IN-2`, and `ASSISTANT` have been removed.
- **Class Coordinator**: Fully excluded from the ERP.
- **Workload Consistency**: Total Workload strictly equals `Teaching Workload` + `Campus Workload`. Remaining capacity is dynamically verified against the canonical role-based `PolicyConfig`.
- **Finalization Safety**: Atomic transaction. Incomplete allocations block finalization.

## Remaining Blockers
- Local Python execution environment denies `pytest` test runs.
- Pending structural section ingest for FLABS.
