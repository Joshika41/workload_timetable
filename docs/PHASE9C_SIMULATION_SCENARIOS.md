# PHASE 9C: SIMULATION SCENARIOS

This document details the scenarios successfully structured and tested in the isolated simulation dataset.

## Supported Solver Scenarios
1. **Normal theory scheduling:** Single-period generic teaching unit (e.g., CS101 Data Structures).
2. **Two-period lab:** A continuous 2-period teaching session (e.g., CS102 Python Lab). Requires the solver to find adjacent slots in a valid lab room.
3. **Cross-department faculty:** Dr. English (English Department) teaching EN101 inside the MCA workspace. Works transparently via the Finalized Allocation acting as the single source of truth.
4. **Elective synchronization:** A defined `SynchronizedGroup` for Electives forcing parallel teaching slots.
5. **Language synchronization:** Structurally identical to electives via `SynchronizedGroup`.
6. **Mixed-section elective:** `Section A` and `Section B` students are placed in a shared `SynchronizedGroup` representing Elective A and B. The solver will place these sessions concurrently.
7. **Faculty unavailable period:** Explicit `UNAVAILABLE` matrix record preventing Dr. CS from being scheduled on Day 0 (Monday), Period 1.
8. **Section unavailable period:** Configurable matrix for section block-outs.
9. **Room unavailable period:** Configurable matrix for room block-outs.
10. **Room capacity constraint:** Rooms explicitly define capacity (e.g., 60 vs 30).
11. **Scarce lab resource:** `L101` explicitly modeled as a PC_LAB, forcing lab sessions to compete for it.
12. **Multiple sections competing:** MCA-A and MCA-B logically competing for Dr. English.
13. **Faculty with multiple assignments:** Dr. CS mapped to Theory, Lab, and Electives simultaneously.

All scenarios rely purely on data structures established in Phase 9B. No solver code is invoked.
