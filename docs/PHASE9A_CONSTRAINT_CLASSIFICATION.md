# PHASE 9A: CONSTRAINT CLASSIFICATION

Constraints dictate the boundaries of the CP-SAT solver. They must be strictly formalized to prevent engine runaway or silent failures.

## 1. HARD CONSTRAINTS
These constraints MUST be satisfied. If any fail, the timetable is INFEASIBLE.
* **Faculty No-Overlap:** A faculty member cannot teach >1 session at the same time.
* **Section No-Overlap:** A student section cannot attend >1 session at the same time.
* **Room No-Overlap:** A room cannot host >1 session at the same time.
* **Protected Breaks:** No sessions can be scheduled during global break times.
* **Working-Day / Period Validity:** Sessions must strictly align with the configured grid.
* **Availability Compliance:** Must strictly honor UNAVAILABLE blocks for Faculty, Sections, and Rooms.
* **Room Capacity & Suitability:** Sections cannot exceed room capacity; Labs must be scheduled in LAB-type rooms.
* **Synchronized Timing:** Electives, Languages, and other Synchronized Groups must occur simultaneously.
* **Mixed-Section Conflicts:** Students drawn from different sections for an elective cannot have conflicting mandatory core subjects.

## 2. SOFT CONSTRAINTS (Optimizations)
The solver will attempt to maximize these, but failures will NOT cause infeasibility.
* **Theory Spread:** Avoid scheduling the same theory subject on consecutive days.
* **Daily Theory Limit:** Avoid repeating a theory subject too often in a single day.
* **Idle Gaps:** Minimize unnecessary free periods (gaps) in a faculty member's daily schedule.
* **Lab-Free Days:** If possible, cluster labs to allow a completely lab-free day for prep.
* **Balanced Workload:** Evenly distribute a faculty's teaching hours across the week.
* **Stable Rooms:** Try to keep a section in the same room for consecutive theory sessions.
* **Compactness:** Minimize building transitions for back-to-back classes.

## 3. CONFIGURABLE CONSTRAINTS
These parameters are dynamic and supplied via the `TimetableRun` config payload:
* **Timetable Grid:** Number of days, periods per day, start/end times.
* **Shift Bounds:** (e.g., Shift 1 limits vs Shift 2 limits).

## 4. POLICY_PENDING
Requirements that require explicit institutional clarification before implementation:
* **30-Hour Reference Issue:** The reference grid shows 30 slots. If a section's finalized workload totals 26 hours, what occupies the remaining 4 slots? Do they remain free, or are non-teaching entities (e.g., Library, Mentoring) modeled as dummy teaching sessions? (Action: Await explicit ERP policy decision. Do not silently fill or drop).
