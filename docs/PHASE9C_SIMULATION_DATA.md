# PHASE 9C: SIMULATION DATA

## Synthetic Data Policy
The timetable generation engine requires robust edge-case testing before deployment. Because the production Supabase database currently lacks finalized schedules and physical room allocations (Sections = 0), a synthetic dataset has been generated.

**CRITICAL RULE:** Synthetic data is permitted **ONLY** in the isolated Simulation Database.

## Dataset Contents
The simulation environment is seeded with:
* **Multi-Institution Hierarchy:** E&T, Flabs, Management, B-Arch.
* **Workspaces:** MCA, BCA, BCA Data Science, B.Sc AIML, M.Sc AIML, B.Sc Computer Science, M.Sc Computer Science.
* **Sections:** Unlike production, synthetic sections (MCA-A, MCA-B, BCA-A) exist with specific student strengths.
* **Faculty:** A mix of home-department and cross-department faculty profiles (e.g., Dr. CS, Dr. English).
* **Finalized Allocations:** Mock `SubjectAllocation` and `AllocationComponent` records mimicking completed HOD workflows.
* **Teaching Sessions:** The deconstructed representation of allocations. Theory courses yield 1-period blocks; Lab courses yield explicit continuous multi-period blocks.
* **Rooms:** Diverse inventory of CLASSROOM and PC_LAB environments.
* **Availability:** Matrices testing `UNAVAILABLE` blocking.

## Integrity Verification
The seeding script explicitly audits consistency:
- Total Allocated Hours match the sum of Teaching Session durations.
- No orphan foreign keys.
- Synchronized groups map to valid sessions and sections.
