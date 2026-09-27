export interface SubjectPref {
  subject_id: number;
  rank: number;
}

export interface PreferenceSubmitRequest {
  workspace_id: string;
  preferences: SubjectPref[];
}

export interface PreferenceItemResponse {
  id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  rank: number;
  decision: 'APPROVE' | 'PENDING' | 'DENIED';
}

export interface PreferenceSubmissionResponse {
  id: number;
  faculty_id: number;
  faculty_name: string;
  academic_year_id: number;
  semester_type: 'ODD' | 'EVEN';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PENDING' | 'DENIED';
  submitted_at: string | null;
  items: PreferenceItemResponse[];
}

export interface PreferenceDecisionRequest {
  decision: 'APPROVED' | 'PENDING' | 'DENIED';
}
