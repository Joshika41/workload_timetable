import { apiClient } from './client';

const workspaceCache: Record<string, { data: any; expiry: number }> = {};

export const academicApi = {
  getInstitutions: () => apiClient.get('/institutions').then(r => r.data),
  getDepartments: () => apiClient.get('/departments').then(r => r.data),
  getProgrammesByDept: (deptId: number) => apiClient.get(`/departments/${deptId}/programmes`).then(r => r.data),
  getSemesters: (programmeId: number, semType: string) =>
    apiClient.get(`/programmes/${programmeId}/semesters`, { params: { sem_type: semType } }).then(r => r.data),
  getWorkspacesByContext: (programmeId: number, semesterType: string) => {
    const cacheKey = `${programmeId}_${semesterType}`;
    const cached = workspaceCache[cacheKey];
    if (cached && Date.now() < cached.expiry) {
      return Promise.resolve(cached.data);
    }
    return apiClient.get('/workspaces-by-context', { params: { programme_id: programmeId, semester_type: semesterType } })
      .then(r => {
        workspaceCache[cacheKey] = { data: r.data, expiry: Date.now() + 15000 };
        return r.data;
      });
  },
  getWorkspaceStatus: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/workflow-status`).then(r => r.data),
  getSubjects: (workspaceId: string) =>
    apiClient.get('/subjects', { params: { workspace_id: workspaceId } }).then(r => r.data),
  finalizeWorkspace: (workspaceId: string) =>
    apiClient.post(`/workspaces/${workspaceId}/finalize`).then(r => r.data),
  // Faculty list for context selection & HOD pool
  getFacultyList: (departmentId?: number) =>
    apiClient.get('/faculty/list', { params: departmentId ? { department_id: departmentId } : {} }).then(r => r.data),

  // Curriculum Subjects (MCA Syllabus & Department Subject Selection)
  getCurriculumSubjects: (departmentId?: number, programmeId?: number, semester?: number) => {
    const params: Record<string, number> = {};
    if (departmentId !== undefined) params.department_id = departmentId;
    if (programmeId !== undefined) params.programme_id = programmeId;
    if (semester !== undefined) params.semester = semester;
    return apiClient.get('/curriculum-subjects', { params }).then(r => r.data);
  },

  batchUpdateCurriculumSubjects: (programmeId: number, semester: number, selectedOfferingIds: number[]) =>
    apiClient.post('/curriculum-subjects/batch-update', {
      programme_id: programmeId,
      semester: semester,
      selected_offering_ids: selectedOfferingIds
    }).then(r => r.data),

  // Department Infrastructure Capacity (Classrooms & Labs)
  getDepartmentCapacity: (departmentId: number) =>
    apiClient.get('/department-capacity', { params: { department_id: departmentId } }).then(r => r.data),

  saveDepartmentCapacity: (payload: {
    department_id: number;
    total_classrooms: number;
    classroom_capacity: number;
    total_labs: number;
    lab_capacity: number;
  }) => apiClient.post('/department-capacity', payload).then(r => r.data),

  // Universal Master Subjects Repository (Super Admin)
  getMasterSubjects: (params?: { search?: string; category?: string }) =>
    apiClient.get('/master-subjects', { params }).then(r => r.data),

  createMasterSubject: (data: any) => apiClient.post('/master-subjects', data).then(r => r.data),
  updateMasterSubject: (id: number, data: any) => apiClient.put(`/master-subjects/${id}`, data).then(r => r.data),
  deleteMasterSubject: (id: number) => apiClient.delete(`/master-subjects/${id}`).then(r => r.data),

  // Weekly Class Timetable (Excel 2026 Format)
  getWeeklyTimetable: (programmeId: number, semester: number, section: string = 'A') =>
    apiClient.get('/timetable/semester-weekly', {
      params: { programme_id: programmeId, semester, section }
    }).then(r => r.data),

  generateWeeklyTimetable: (payload: {
    programme_id: number;
    semester: number;
    department_id: number;
    section?: string;
    default_room?: string;
  }) => apiClient.post('/timetable/generate-weekly', payload).then(r => r.data),

  saveWeeklyTimetable: (payload: {
    programme_id: number;
    semester: number;
    department_id: number;
    section?: string;
    schedule: any[];
  }) => apiClient.post('/timetable/save-weekly', payload).then(r => r.data),

  swapTimetableSlots: (payload: {
    programme_id: number;
    semester: number;
    section?: string;
    slot_a_id: string;
    slot_b_id: string;
  }) => apiClient.post('/timetable/swap-slots', payload).then(r => r.data),
};

export const facultyApi = {
  getHODFacultyList: (semesterType?: string) =>
    apiClient.get('/faculty/hod', { params: semesterType ? { semester_type: semesterType } : {} }).then(r => r.data),
};

// ── Auth
export const authApi = {
  login: (formData: URLSearchParams) => apiClient.post('/auth/login', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(r => r.data),
  getProfiles: (role: string, institutionId: number) =>
    apiClient.get('/auth/profiles', { params: { role, institution_id: institutionId } }).then(r => r.data),
  demoLogin: (payload: any) => apiClient.post('/auth/demo-login', payload).then(r => r.data),
};

// ── Preferences
export const preferencesApi = {
  getMyPreferences: (workspaceId: string) =>
    apiClient.get('/faculty/preferences', { params: { workspace_id: workspaceId } }).then(r => r.data),
  submitPreferences: (workspaceId: string, preferences: { subject_id: number; rank: number }[]) =>
    apiClient.post('/faculty/preferences', { workspace_id: workspaceId, preferences }).then(r => r.data),
  getAllPreferences: (workspaceId: string) =>
    apiClient.get('/coordinator/preferences', { params: { workspace_id: workspaceId } }).then(r => r.data),
  reviewSubmission: (submissionId: number, reviewStatus: string) =>
    apiClient.patch(`/coordinator/preferences/submissions/${submissionId}/review`, { review_status: reviewStatus }).then(r => r.data),
};

// ── Allocations
export const allocationApi = {
  getAll: (workspaceId: string) =>
    apiClient.get('/allocations', { params: { workspace_id: workspaceId } }).then(r => r.data),
  create: (workspaceId: string, sectionId: number, subjectId: number, components: any[]) =>
    apiClient.post('/allocations', { section_id: sectionId, subject_id: subjectId, components }, { params: { workspace_id: workspaceId } }).then(r => r.data),
  setFacultyCycleState: (facultyId: number, workspaceId: string, state: string, reason?: string) =>
    apiClient.post(`/faculty/${facultyId}/cycle-state`, null, { params: { workspace_id: workspaceId, state, reason } }).then(r => r.data),
};

// ── Workload
export const workloadApi = {
  getDashboardStats: (semesterType?: string, workspaceId?: string) =>
    apiClient.get('/workload/dashboard', { params: { semester_type: semesterType, workspace_id: workspaceId } }).then(r => r.data),
  getFacultyWorkload: (workspaceId: string) =>
    apiClient.get('/workload/faculty', { params: { workspace_id: workspaceId } }).then(r => r.data),
  getWorkloadViewer: (semesterType: string) =>
    apiClient.get(`/workload/viewer/${semesterType}`).then(r => r.data),
  getClassMatrix: (workspaceId: string) =>
    apiClient.get('/workload/class-matrix', { params: { workspace_id: workspaceId } }).then(r => r.data),
  getMySubjects: (workspaceId: string) =>
    apiClient.get('/workload/my-subjects', { params: { workspace_id: workspaceId } }).then(r => r.data),
  finalizeWorkload: (workspaceId: string) =>
    apiClient.post('/workload/finalize', null, { params: { workspace_id: workspaceId } }).then(r => r.data),
  exportPdf: (workspaceId: string) =>
    apiClient.get('/workload/export.pdf', { params: { workspace_id: workspaceId }, responseType: 'blob' }).then(r => r.data),
};

// ── Settings
export const settingsApi = {
  getCaps: () => apiClient.get('/workload/settings/caps').then(r => r.data),
  updateCaps: (caps: Record<string, number>) => apiClient.post('/workload/settings/caps', caps).then(r => r.data),
};
