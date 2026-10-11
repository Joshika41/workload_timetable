# Phase 6 Workflow

## Workflow Lifecycle
1. **HOD Login & Dashboard**:
   HOD accesses the `HODHome` dashboard. The UI fetches real data via `/api/workload/dashboard` (Faculty count, allocation progress, reconciliation status, finalization state).

2. **Faculty Details**:
   HOD views faculty listings strictly ordered by seniority and alphabetically. The target workload is resolved dynamically without assuming 18 for everyone.

3. **Preference vs. Allocation**:
   Preferences remain reference material only. HODs allocate subjects explicitly. A preference does NOT automatically become an allocation.

4. **Allocation & Hours**:
   HOD allocates faculty to subjects with roles `Incharge-1` or `Incharge-2`. Theory and Practical hours are provided. Total hours are derived backend-side. Conflicts are restricted to explicit academic contexts + sections.

5. **Reconciliation**:
   The backend continually measures required hours (subject * sections) against allocated component hours. The reconciliation API strictly checks if the allocated total equals the required total. Statuses map to `RECONCILED`, `MISSING_ALLOCATION`, `PARTIALLY_ALLOCATED`, or `OVER_ALLOCATED`.

6. **Finalization Transaction**:
   The `/api/workload/finalize/department` triggers an atomic transaction. It validates:
   - No negative/zero hours.
   - All subjects strictly reconcile perfectly.
   - Target workload hour caps are not violated.
   If valid, the system locks allocations to `FINALIZED`.

7. **PDF Export**:
   Only accessible post-finalization. Exports canonical finalized workload records without faking data.
