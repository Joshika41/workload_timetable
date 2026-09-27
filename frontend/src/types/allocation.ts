export interface AllocationComponentRequest {
  faculty_id: number;
  role: 'Incharge-1' | 'Incharge-2';
  theory_hours: number;
  practical_hours: number;
}

export interface SubjectAllocationRequest {
  workspace_id: string;
  section_id: number;
  components: AllocationComponentRequest[];
}

export interface AllocationComponentResponse {
  id: number;
  faculty_id: number;
  faculty_name: string;
  role: 'Incharge-1' | 'Incharge-2';
  theory_hours: number;
  practical_hours: number;
}

export interface SubjectAllocationResponse {
  id: number;
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name: string;
  status: 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'ALLOCATED' | 'FINALIZED';
  components: AllocationComponentResponse[];
}
