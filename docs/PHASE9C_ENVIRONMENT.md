# PHASE 9C: ENVIRONMENT ISOLATION

## Production vs. Simulation Separation
The ERP utilizes two fundamentally distinct environments for Timetable Phase 2 development.

### 1. Production Database
* **Status:** UNTOUCHED.
* **Integrity:** `sections` table remains at 0 rows for FLABS. Workload allocations remain exactly as generated in Phase 1-8.
* **Protection:** Hard-coded guards in the simulation seed script will explicitly `sys.exit(1)` if executed against a database URL containing "supabase" and "production" markers.

### 2. Simulation Database (Staging)
* **Status:** MOCKED.
* **Schema:** Perfectly mirrors the production Alembic schema (`18aedd9497d3_add_timetable_models`).
* **Connection:** Triggered via the `SIMULATION_DATABASE_URL` environment variable. 
* **Reset Procedure:** The `seed_timetable_simulation.py` script is designed to safely rebuild the memory or local test database from scratch to test generation edge cases without risk to real data.

## KAIROS Execution Boundary
This environment isolation guarantees that when KAIROS is eventually invoked, it operates purely on synthetic arrays, leaving institutional truth securely sandboxed. No CP-SAT or OR-Tools logic is permitted to execute during this data-preparation phase.
