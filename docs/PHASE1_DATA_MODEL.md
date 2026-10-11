# SRM University Workload ERP - Phase 1 Canonical Data Model

## 1. Core Principles
The database model is fully normalized to handle any number of institutions, departments, programmes, semesters, and sections without schema alterations.

## 2. Academic Context
- **Institution**: Represents a global entity (e.g., E&T, Management, Flabs).
- **Department**: Scoped to an Institution.
- **Programme**: Scoped to a Department (e.g., MCA GEN AI). Represents the exact degree path.
- **AcademicWorkspace**: The canonical contextual container bridging Department + Programme + AcademicYear + Semester + ProgrammeYear. Represents a unique slice of time and space for workload management.

## 3. Curriculum and Subjects
- **Subject**: Represents the core syllabus definition (Course Code, Title, Theory, Lab).
- **CurriculumOffering**: Links a Subject to an AcademicYear, Programme, and Semester Type (ODD/EVEN).
- **Section**: Represents the actual physical class subdivisions for a specific Workspace. Bound specifically by `workspace_id` to ensure absolute isolation. Stores `student_strength`.

## 4. Faculty and Roles
- **User**: Authentication layer and access control.
- **FacultyProfile**: Demographic and ERP properties. Includes `seniority_index` (for ordering), `target_workload` (replaces hardcoded 18 hours), and `campus_work_hours` (for non-teaching deductions).
- **AllocationRoleEnum**: Strictly enforces `INCHARGE_1` and `INCHARGE_2`. All legacy "MAIN" and "ASSISTANT" flags have been replaced.

## 5. Subject Allocation
- **PreferenceSubmission** / **PreferenceItem**: Stores faculty choices completely isolated from final allocations.
- **SubjectAllocation**: The canonical assignment. Bridges `workspace_id`, `subject_id`, `section_id`, `faculty_id`, and `AllocationRoleEnum`. Derived totals (`theory_hours + lab_hours`) are dynamically verified against the Faculty `target_workload` cap.

## 6. Constraints and Referential Integrity
- `Section.workspace_id` (NOT NULL): Ensures sections can never float outside an academic context.
- `FacultyProfile.user_id` (UNIQUE): 1:1 mapping.
- `SubjectAllocation`: Must reference a valid `section_id` bound to the same `workspace_id`.

## 7. Migration Notes
The schema additions applied in this phase:
1. `FacultyProfile.seniority_index` (Integer)
2. `FacultyProfile.target_workload` (Integer)
3. `FacultyProfile.campus_work_hours` (Integer) - For non-teaching hours
4. `Section.student_strength` (Integer)
5. `Section.is_active` (Boolean)
