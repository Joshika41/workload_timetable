# Phase 6 Architecture

## Overview
Phase 6 introduces the HOD-side workload workflow, including allocation, reconciliation, and finalization. The architecture adheres to the `Router → Service → Repository → Database` principle.

## Components
1. **API Routers**:
    - `workload.py`: Handles HOD dashboard stats, workload retrieval, and the atomic finalization workflow.
    - `allocation.py`: Manages the creation, updating, and fetching of allocations.

2. **Services**:
    - `workload_service.py`: Computes faculty workload from `AllocationComponent` records, generates class matrices, and performs the mandatory Java reconciliation test logic via `calculate_subject_reconciliation`.
    - `faculty_service.py`: Resolves canonical target workloads using explicit overrides or policy fallback configs (e.g., max_professor=12, max_assistant=16).
    - `allocation_service.py`: Processes allocation creations enforcing business rules (e.g., Theory/Practical bounds).

3. **Domain Models (`domain.py`)**:
    - `SubjectAllocation`: Links a workspace, section, and subject.
    - `AllocationComponent`: Associates a faculty with an allocation and role (only `INCHARGE_1` or `INCHARGE_2`), storing `theory_hours` and `practical_hours`.

## Explicit Exclusions
This phase does **not** introduce any of the following Phase 2 concepts:
- Timetables or KAIROS solver algorithms
- Days, periods, rooms, teaching sessions
- "Class Coordinator" data fields or UI components
- Fake sections or mock data for visualization. Empty FLABS sections render empty states gracefully.
