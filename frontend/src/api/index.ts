import { apiClient } from './client';

// ── Context / Academic
export const academicApi = {
  getInstitutions: () => apiClient.get('/institutions').then(r => r.data),
  getDepartments: () => apiClient.get('/departments').then(r => r.data),
  getProgrammesByDept: (deptId: number) => apiClient.get(`/departments/${deptId}/programmes`).then(r => r.data),
  getSemesters: (programmeId: number, semType: string) =>
    apiClient.get(`/programmes/${programmeId}/semesters`, { params: { sem_type: semType } }).then(r => r.data),
  getWorkspacesByContext: (programmeId: number, semesterType: string) =>
    apiClient.get('/workspaces-by-context', { params: { programme_id: programmeId, semester_type: semesterType } }).then(r => r.data),
  getWorkspaceStatus: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/workflow-status`).then(r => r.data),
  getSubjects: (workspaceId: string) =>
    apiClient.get('/subjects', { params: { workspace_id: workspaceId } }).then(r => r.data),
  finalizeWorkspace: (workspaceId: string) =>
    apiClient.post(`/workspaces/${workspaceId}/finalize`).then(r => r.data),
  // Faculty list for context selection & HOD pool
  getFacultyList: (departmentId?: number) =>
    apiClient.get('/faculty/list', { params: departmentId ? { department_id: departmentId } : {} }).then(r => r.data),
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
  getFacultyWorkload: (workspaceId: string) =>
    apiClient.get('/workload/faculty', { params: { workspace_id: workspaceId } }).then(r => r.data),
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
