# PHASE 9A: TIMETABLE ARCHITECTURE

## 1. Existing ERP Architecture Audit
The Phase 2 Timetable Engine will consume the following **Finalized Allocation Records** as its source of truth:
* **AcademicWorkspace / AcademicContext**: Defines the boundary.
* **Section**: Defines the distinct student cohorts.
* **SubjectAllocation**: The confirmed assignment of a Subject to a Section.
* **AllocationComponent**: The confirmed assignment of Faculty to a SubjectAllocation, including specific roles and theory/practical hour split.
* **FacultyProfile**: The allocated instructors.

**Important:** The engine will NOT consume draft preferences, unfinalized workspaces, or runtime Excel files. The upstream source of teaching obligations is strictly the **Finalized Allocation**.

## 2. Proposed Timetable Entities

### TeachingSession (Clarification)
A derived, schedulable unit representing a continuous block of teaching.
* **Theory**: 1 required teaching hour = 1 schedulable 1-period unit, unless the configuration explicitly dictates otherwise (e.g., 2-period theory blocks).
* **Lab**: Lab hours must be explicitly configured and continuous. Do NOT assume "1 lab = 1 block". The engine must support 2-period labs, 3-period labs, etc. Requirements state lab continuity must be preserved with a maximum of two consecutive lab sessions for a particular lab subject.
* `id` (PK)
* `allocation_component_id` (FK to finalized workload)
* `session_type` (THEORY, LAB, STUDIO)
* `duration_periods` (explicit block duration)
* `sync_group_id` (Optional FK to a SynchronizedGroup)

### Room
A master list of physical spaces.
* `room_code`, `room_type`, `capacity`, `metadata` (JSONB for suitability tags).

### Availability Models
Explicitly maps when an entity is available. Defaults to AVAILABLE.
* **FacultyAvailability**, **SectionAvailability**, **RoomAvailability**.

### TimetableRun & TimetableVersion
Tracks generation operations and version history without overwriting old runs.

### TimetableEntry
The canonical representation of a scheduled block.

## 3. Electives, Languages & Mixed Sections (Synchronization Clarification)
First-class synchronization support requires explicitly grouping sessions that must co-occur.
* **SynchronizedGroup**: A synchronized group must define at minimum:
  - same day
  - same start period
  - same duration
  While explicitly allowing:
  - different faculty
  - different rooms
  - different offerings
  - different student memberships (mixed-section students)
* **SynchronizedGroupMember**: Maps sessions into the group. Synchronization must be strictly defined by these groups, NOT inferred loosely from subject names (e.g., "French 1"). This covers electives, languages, and any mixed-section sessions.

## 4. Scalability & Shifts
The timetable grid is NOT hardcoded. A configuration payload defines the structure (e.g. `Shift 1: P1 08:00-08:45...`), supporting future afternoon shifts without code changes.

## 5. Simulation Data Isolation
Simulation data will be strictly isolated using a `WorkspaceWorkflowStateEnum.SIMULATION` context or a dedicated `is_simulation` flag on workspaces. Simulated runs will NOT pollute real FLABS records.
