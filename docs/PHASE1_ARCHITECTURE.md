# SRM University Workload ERP - Phase 1 Canonical Architecture

## 1. Unified Architecture Principles
The system now adheres strictly to a **Modular Monolith** pattern with a strict separation between Frontend representation (React/Vite) and Backend service boundaries (FastAPI).

## 2. Active Frontend Architecture (`frontend/src/`)
All legacy `routes/` and file-based dynamic routes have been removed. The active frontend architecture consists of:
- `pages/`: Role-specific directories (`hod/`, `faculty/`, `admin/`).
- `components/`: Pure, reusable UI and logical wrappers. No direct API mutation side-effects.
- `context/`: React context providers for Workspace, Session, and Auth.
- `api/`: Centralized Axios instances (`academicApi`, `authApi`).
- `types/`: Strict TypeScript typings matching the backend Pydantic models.

## 3. Active Backend Architecture (`backend/app/`)
All legacy monolithic files (`main.py` in the root) and old `/routers` have been eradicated.
- `main.py`: The single entrypoint mounting exactly ONE set of API routers.
- `routers/`: Modular controllers (`auth.py`, `academic.py`, `faculty.py`, `allocations.py`).
- `services/`: Business logic layer separating HTTP requests from DB queries. Finalization is an atomic service.
- `models/`: Canonical SQLAlchemy domain models (`domain.py`).
- `schemas/`: Pydantic validation definitions reflecting exact API contracts.

## 4. API Contract Principles
- **No Duplicate Endpoints**: Functions like workload finalization exist at exactly one canonical endpoint (`POST /api/workload/finalize`).
- **Context-Bound**: Every request altering academic state must supply `workspace_id` and pass `verify_workspace_access()`.

## 5. Directory Structure
```text
workload_timetable/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── core/
│   │   ├── database/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   └── alembic/
```
