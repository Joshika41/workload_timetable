# Phase 9E.1 Synchronization

## Overview
Synchronized teaching sessions require identical constraints (start day, start slot, and duration). Our architecture dictates that this behavior should be modeled externally to the KAIROS solver where possible. However, CP-SAT natively models slot placement internally, so a minimal vendor configuration change was unavoidable.

## Implementation Details
1. **Config Modification:** Added `synchronized_blocks` to `Config`. It takes a tuple of tuples containing `block_id`s that must be synchronized.
2. **Constraint Enforcement:** In `model_cpsat.py`, directly after the `H1` (ExactlyOne) constraint, a new hard constraint ensures that for each possible `(day, start)` combination, the assignment state of all synchronized blocks must be strictly equal.
3. **Adapter Preparation:** The ERP-side adapter (`run_simulation_solve.py`) iterates through `SynchronizedGroup` and `SynchronizedGroupMember` models to dynamically generate the `synchronized_blocks` tuples and passes them via `cfg.synchronized_blocks`.
4. **Result:** The CP-SAT solver successfully schedules these sessions simultaneously, allowing different instructors or rooms to be used.

## Justification for Vendor Modification
The alternative required generating artificial overlapping dummy sections which violates H2 room occupancy rules, or heavy solver refactoring. Injecting one localized `model.Add(base_sum == other_sum)` ensures KAIROS retains optimal solving speeds without architectural pollution.
