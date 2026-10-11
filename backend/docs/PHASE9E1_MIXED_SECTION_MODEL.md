# Phase 9E.1 Mixed-Section Model

## Overview
Mixed sections occur when multiple student cohorts (sections) participate in the exact same physical teaching session.

## Constraint Model
We must prevent student conflicts without duplicating physical sessions (which would erroneously double-book rooms or faculty).

1. **ERP Side:** The ERP models this as a single `TeachingSession` representing the physical meeting. Secondary sections participating in the session are linked via `SynchronizedGroupMember` records pointing to this single session.
2. **KAIROS Side:** KAIROS relies on `section_occ` (hard constraint) to prevent a section from being double-booked. To inform KAIROS of secondary section involvement, we modified the `Block` dataclass to include `extra_section_ids`.
3. **CP-SAT Integration:** When mapping blocks to slots, `model_cpsat.py` populates `section_occ` with the primary `section_id` *and* any `extra_section_ids`.
4. **Adapter Construction:** `run_simulation_solve.py` identifies mixed sections, extracts all potential KAIROS `section_id` formats for the secondary sections, and provides them to the `Block`.

This guarantees student-conflict safety natively within the CP-SAT engine while treating the meeting as one continuous physical event.
