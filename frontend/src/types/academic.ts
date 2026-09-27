export interface ProgrammeBase {
  id: number;
  name: string;
  programme_type: string;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  programmes: ProgrammeBase[];
}

export interface Section {
  id: number;
  name: string;
}

export interface AcademicWorkspaceResponse {
  workspace_id: string;
  department_id: number;
  department_name: string;
  programme_id: number;
  programme_name: string;
  programme_year: number;
  academic_year_id: number;
  academic_year_name: string;
  semester: number;
  semester_type: "ODD" | "EVEN";
  workflow_state: string;
  sections: Section[];
}
