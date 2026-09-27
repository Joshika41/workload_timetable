export interface FacultyWorkloadResponse {
  faculty_id: number;
  faculty_name: string;
  designation: string;
  total_theory_hours: number;
  total_practical_hours: number;
  total_teaching_hours: number;
  status: string;
}

export interface ClassMatrixRow {
  subject_code: string;
  subject_name: string;
  theory: number;
  practical: number;
  total: number;
  main_faculty: string;
  assistant_faculty?: string;
  status: string;
}
