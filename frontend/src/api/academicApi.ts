import { apiClient } from './client';
import type { DepartmentResponse, AcademicWorkspaceResponse } from '../types/academic';

export const academicApi = {
  getDepartments: async (): Promise<DepartmentResponse[]> => {
    const response = await apiClient.get<DepartmentResponse[]>('/departments');
    return response.data;
  },
  
  getWorkspaces: async (): Promise<AcademicWorkspaceResponse[]> => {
    const response = await apiClient.get<AcademicWorkspaceResponse[]>('/academic-workspaces');
    return response.data;
  },

  getSubjects: async (workspaceId: string): Promise<any[]> => {
    const response = await apiClient.get<any[]>('/subjects', {
        params: { workspace_id: workspaceId }
    });
    return response.data;
  }
};
