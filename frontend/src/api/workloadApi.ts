import { apiClient } from './client';
import type { FacultyWorkloadResponse, ClassMatrixRow } from '../types/workload';

export const workloadApi = {
  getFacultyWorkloads: async (workspaceId: string): Promise<FacultyWorkloadResponse[]> => {
    const response = await apiClient.get<FacultyWorkloadResponse[]>('/workload/faculty', {
      params: { workspace_id: workspaceId }
    });
    return response.data;
  },
  
  getClassMatrix: async (workspaceId: string): Promise<ClassMatrixRow[]> => {
    const response = await apiClient.get<ClassMatrixRow[]>('/workload/class-matrix', {
      params: { workspace_id: workspaceId }
    });
    return response.data;
  },

  getMySubjects: async (workspaceId: string): Promise<any[]> => {
    const response = await apiClient.get<any[]>('/workload/my-subjects', {
      params: { workspace_id: workspaceId }
    });
    return response.data;
  },

  exportPdf: async (): Promise<Blob> => {
    const response = await apiClient.get<Blob>('/workload/export.pdf', {
      responseType: 'blob'
    });
    return response.data;
  }
};
