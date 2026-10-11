export interface FacultyWorkloadResponse {
  faculty_id: number;
  faculty_name: string;
  designation: string;
  total_theory_hours: number;
  total_practical_hours: number;
  total_teaching_hours: number;
  campus_work_hours: number;
  target_workload: number;
  remaining_capacity: number;
  status: string;
}

export interface ClassMatrixRow {
  subject_code: string;
  subject_name: string;
  theory: number;
  practical: number;
  total: number;
  incharge_1: string;
  incharge_2?: string;
  status: string;
}
