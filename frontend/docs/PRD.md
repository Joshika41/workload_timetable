# Project Requirements Document (PRD)
**Project Name:** Workload and Timetable Portal (Phase 1: Workload)
**Version:** 1.0

## 1. Overview
The Workload and Timetable Portal is a dynamic, context-aware ERP designed for the Faculty of Science and Humanities at SRM Ramapuram. It facilitates the seamless collection of faculty subject preferences and the HOD's workload allocation. 

## 2. User Roles
- **HOD (Head of Department)**: Can review faculty subject preferences, allocate workloads, manage "No Teaching" states, and finalize the departmental workload.
- **Faculty**: Can view available subjects for their department/programme/semester and submit their ranked preferences.

## 3. Workflow & Context Selection
- **Seamless Login**: Users do not require credentials. They select their context:
  1. Department (e.g., MCA & MCA GEN AI)
  2. Programme (e.g., MCA GEN AI)
  3. Semester Type (Odd or Even)
  4. Role (Enter as HOD or Enter as Faculty)
- **Context-Aware Routing**: The system automatically limits data visibility to the selected context.

## 4. Features & Pages

### 4.1 HOD Portal
- **HOD Dashboard**: Displays high-level stats (Total Semesters, Total Subjects, Faculty Submitted vs. Pending).
- **Preference Management**:
  - Displays a complete list of departmental faculty and their current status (Pending, Submitted, Allocated, No Teaching).
  - HOD can select a faculty member, review their preferred subjects, and click **Approve Submission**.
  - HOD can allocate subjects (assigning Section, Role, Theory/Practical hours).
  - HOD can offer additional (non-preferred) subjects.
  - A Progress Sphere dynamically updates as faculty are allocated.
  - Finalize Workload button becomes enabled when 100% of faculty are addressed.
- **Workload Viewer & Matrix**: Provides a tabular, class-wise view of all finalized allocations.

### 4.2 Faculty Portal
- **Faculty Home**: Displays all active semesters in the selected context.
- **Subject Preferences**: 
  - Displays the *actual* subjects (Course Code, Name, L-T-P-C, Core/Elective) dynamically parsed from institutional curriculum rules.
  - Faculty can select subjects and click **Submit Preferences**.
  - UI updates to show the submission status (Pending, Submitted, Approved, or Allocated).

## 5. System Architecture
- **Frontend**: React + Vite, styled with custom CSS for a premium, institutional UI.
- **Backend**: FastAPI (Python) serving a RESTful API.
- **Database**: SQLite (SQLAlchemy ORM) with a robust schema separating Workspaces, Subjects, Faculty, and Allocations.

## 6. Future Extensibility (Phase 2)
The architecture supports the future addition of Phase 2 (Timetable generation). The `SubjectAllocation` tables are designed to map directly into timetable slots.
