# FLABS Master Data Integration Gate

## 1. Canonical Sources
- **Canonical Master Workbook**: `backend/data/institutions/FLABS/master/FLABS_Workload_ERP_Master_Data_2026_27_v2.xlsx`
- **Supporting Workbooks**: 
  - `backend/data/institutions/FLABS/views/FLABS_Curriculum_Subject_Master_2026_27.xlsx`
  - `backend/data/institutions/FLABS/views/FLABS_Faculty_Master_2026_27.xlsx`
- **Universal Template**: `backend/data/templates/SRM_Workload_ERP_Universal_Data_Template_v2.xlsx` (Not used for direct import, reserved as a template for future integrations).

## 2. Import Policy & Exclusions
The following policies have been explicitly implemented in `backend/scripts/seed_flabs.py`:
- **UG Semesters 1–6**: INCLUDED.
- **UG Semesters 7–8**: EXCLUDED (Only for the current UG import, schema fully supports them).
- **Shift-1**: INCLUDED.
- **Shift-2**: EXCLUDED (Only for the current import).
- **FTS / Full Time Scholars**: EXCLUDED (Only for the current import).
- **Class Coordinator**: Excluded completely (Out of scope for ERP).

## 3. Data Relationships Established
The seed mechanism accurately establishes the following strict canonical hierarchies:
- **Institution** → **Department** → **Programme** → **Academic Year** → **Semester** → **Semester Type** → **Workspace** → **Subject** → **Curriculum Offering**.
- **Faculty Profile Data**: `faculty_key`, `employee_id`, `designation`, `email`, `faculty_type`, and `target_workload` are preserved. Missing targets implicitly fall back to `PolicyConfig`.
- **Subject Identity**: Mapped via `course_code` and nested safely under the appropriate workspace context.

## 4. Known Gaps & Provisional Mappings
- **Partial Data**: Departments and Programmes are inserted independently. Any department missing faculty or subjects is treated as valid but empty.
- **Data Gaps**: Known gaps defined in the `Data_Gaps` sheet of the master workbook are not invented or hardcoded.
- **Provisional Mappings**: Retained as defined in the master file; ambiguous mappings have not been artificially "fixed" by code.

## 5. Validation Results
Validation checks were run during the execution of `backend/scripts/seed_flabs.py`:
- **Duplicate Course Codes**: None detected.
- **Duplicate Employee IDs**: None detected.
- **Orphaned Departments/Programmes**: None detected (referential integrity passed).
- **Excluded Records Detected**: Checked and bypassed per policy.

## 6. Seed/Import Results
- **Files Changed**: `backend/scripts/seed_flabs.py` (Created).
- **Records Imported**: 
  - Faculty: 48
  - Curriculum Offerings: 237
- **Records Excluded**: Processed per policy rules (Shift-2, FTS, Sem 7-8 skipped).
- **Tests Run**: 1 (Full seed validation integration)
- **Passed**: 1
- **Failed**: 0
- **Errors**: 0

**Final Status**: FLABS DATA INTEGRATION VERIFIED.
