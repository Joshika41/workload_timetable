# PHASE 9A: KAIROS INTEGRATION AUDIT

## 1. KAIROS Repository Audit
KAIROS (https://github.com/huguryildiz/KAIROS) is a CP-SAT based solver for university course timetabling.

**Verified Modules & Responsibilities (from actual KAIROS repo):**
* `src/timetabling/model.py`: Defines the KAIROS Data Model (DTOs like Course, Room, ClassGroup, Instructor).
* `src/timetabling/model_cpsat.py`: Contains the core OR-Tools CP-SAT model initialization and the constraint builders.
* `src/timetabling/pipeline.py`: Coordinates the end-to-end solving process.
* `src/timetabling/validate.py`: Validates schedules and constraint logic.
* `src/timetabling/export.py` & `src/timetabling/report.py`: Handles exporting the solved schedule and generating metrics.

## 2. The KAIROS Adapter Boundary
The ERP must NOT expose KAIROS objects to the React frontend or FastAPI routers.

**Data Flow:**
`ERP Timetable Model` → `KAIROS Input DTO (model.py)` → `KAIROS Engine (model_cpsat.py / pipeline.py)` → `KAIROS Output (validate.py / export.py)` → `ERP Timetable Model`

### ERP to KAIROS Concept Mapping
| ERP Entity | KAIROS Entity (`model.py`) | Transformation Needed | Notes |
|---|---|---|---|
| FacultyProfile | Instructor | Map ID | Needs mapping to CP-SAT/KAIROS IDs or string keys |
| Section | ClassGroup / Cohort | Map ID | Represents a group of students |
| Room | Room | Map Details | Capacity, building, and suitability flags mapped to KAIROS limits |
| TeachingSession | Course / Session | Decompose | Finalized workload hours must be decomposed into explicit block durations |
| TimetableConfiguration | Config / Settings | Adapter Injection | Maps ERP shifts/periods into KAIROS time slots |
| Availability | Constraints / Blackouts | Adapter Injection | Converts ERP UNAVAILABLE slots to KAIROS blackout periods |
| SynchronizedGroup | Hard Constraint | Custom Builder | Enforces exact same day/time assignment across multiple sessions |

## 3. Infeasibility Handling
If KAIROS fails to find a solution (INFEASIBLE):
* The engine will **NOT** silently drop sessions or modify the upstream workload allocations.
* The `TimetableRun` will be marked as `FAILED`.
* The adapter will attempt to extract the unschedulable core conflicts (e.g., using `report.py` or diagnostic logic) and persist them in the `diagnostics` JSON field for HOD review.
