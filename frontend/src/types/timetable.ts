export interface TimetableEntry {
  id: number;
  day_index: number; // 0 = Mo, 1 = Tu, 2 = We, 3 = Th, 4 = Fr
  period_number: number; // 1 to 6 (Break is 10:15 - 10:30 between P3 and P4)
  duration: number; // in periods (e.g. 1 for theory, 2 or 3 for lab)
  teaching_type: 'THEORY' | 'LAB';
  room: string;
  room_type?: string;
  faculty: string;
  faculty_id?: number;
  user_id?: number;
  subject: string;
  subject_code: string;
  sections: string[]; // e.g. ["Section A"], ["Section B"] or synchronized ["Section A", "Section B"]
  is_synchronized?: boolean;
}

export interface CourseReferenceItem {
  category: string; // e.g. 'CORE', 'ELECTIVE', 'LAB', 'ALLIED'
  course_code: string;
  course_name: string;
  faculty_name: string;
  department: string;
  credits: number;
  theory_hours: number;
  practical_hours: number;
  allotted_hours: number;
}

export interface TimetableVersionInfo {
  id: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  created_at: string;
  run_id?: number;
  solver_status?: string;
  violations?: number;
}

export interface TimetableResponse {
  version_id: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'NOT_FOUND';
  created_at?: string;
  workspace_id?: string;
  programme?: string;
  semester?: number;
  semester_type?: 'ODD' | 'EVEN';
  entries: TimetableEntry[];
  course_references?: CourseReferenceItem[];
}
