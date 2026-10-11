# Phase 1 Business Rules (Updated for Phase 4 Context)

## 1. Academic Context Hierarchy
- **Institution -> Department -> Programme -> Academic Year -> Semester -> Workspace -> Section**
- Every workload operation (preferences, allocations, sections) is strictly bound to a singular `workspace_id`.
- Data is isolated across workspaces and institutions. Faculty from one institution cannot view or be allocated to workspaces in another institution unless explicitly bridged by a cross-institution relationship.

## 2. Faculty Target Workload
The resolution of a faculty member's target workload strictly follows this precedence hierarchy:
1. **Faculty-Specific Target**: Direct override assigned to `FacultyProfile.target_workload`.
2. **Designation/Policy Target**: Retrieved from `PolicyConfig` based on the faculty's designation (e.g., Professor = 12, Associate = 14, Assistant = 16).
3. **Fallback**: A safe 18-hour default is only used if none of the above are configured.

## 3. Capacity and Workload Calculation
- **Remaining Capacity** = `Target Workload - (Teaching Allocation Hours + Campus Work Hours)`
- **Teaching Allocation Hours** = Sum of (`theory_hours` + `lab_hours`) across all active allocations for the faculty.
- Reductions for roles like "Incharge-1" (e.g., a 2-hour reduction) are processed per policy and affect the net teaching allocation hours consumed by that subject.

## 4. Subject Allocation Roles
- Only two roles are valid for allocations: **Incharge-1** and **Incharge-2**.
- Legacy roles (Main, Assistant) are completely deprecated and invalid.

## 5. Subject Preferences
- Faculty must submit preferences containing **at least one CORE** subject and **at least one ELECTIVE** subject to be valid (enforced at API level via `422 Unprocessable Entity`).
- Minor and Multidisciplinary subjects are optional.
- Preferences are strictly scoped to the active `workspace_id`.

## 6. Deprecated Rules
- **Class Coordinator**: Completely out of scope. No business rules, logic, tags, or constraints exist for Class Coordinators.
- **MCA-Only Assumption**: The application does not contain hardcoded logic treating the "MCA" department or programmes distinctly. All logic is driven uniformly across all configured programmes.
