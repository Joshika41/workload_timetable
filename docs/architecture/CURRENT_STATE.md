# Current State: Phase A

## Overview
Phase A of the Academic Workload & Timetable Portal has been implemented as a full-stack, vertically integrated slice. The application has transitioned from purely mock-data UI prototypes to a functional web application backed by a real PostgreSQL database via FastAPI, and a React frontend interacting through verified API endpoints.

## Implemented Architecture
- **Database (PostgreSQL via SQLite currently)**: Database schema uses SQLAlchemy ORM models covering Users, Roles, Faculty Profiles, Departments, Curriculums, Sections, Preferences, and Subject Allocations.
- **Backend (FastAPI)**: Implements standard 3-layer architecture (`Controller` -> `Service` -> `Repository`).
- **Authentication**: JWT-based role-based access control (RBAC). User sessions enforce context-aware fetching based on department affiliation.
- **Frontend (React/Vite)**: Connects to the backend via an API client (`apiClient.ts`). Global state previously driven by mock static arrays has been migrated to live API hooks (`useWorkloadData`).

## Core Workflows Realized
1. **Academic Workspace Retrieval**: Dropdowns populate valid section contexts corresponding to a user's department using `CurriculumOffering`.
2. **Subject Exposure**: Faculty can fetch the subjects associated with their department and submit preferences (`rank`).
3. **Preference Review**: Coordinators/HODs pull live preference submissions and update their status (e.g. `APPROVED` or `DENIED`).
4. **Subject Allocation**: HODs map Faculty members to specific subjects in a section. The system computes the current total assigned teaching hours for `MAIN` and `ASSISTANT` roles and calculates the allocation status (`UNALLOCATED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`, `FINALIZED`).
5. **Class-Wise Matrix**: Live view of subject allocations tied to a specific section mapped to the official format.
6. **Live Workload Tracking**: Real-time aggregation of teaching hours across all assigned subjects for a faculty member.

## Verification
- An automated integration test suite (`backend/test_workflow.py`) validates the core E2E state transition across `Login -> View Workspace -> View Subjects -> Submit Preferences -> Approve Preferences -> Allocate Subject -> Verify Workloads`.
