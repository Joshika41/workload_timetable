import { apiClient } from './client';
import type { SubjectAllocationRequest, SubjectAllocationResponse } from '../types/allocation';

export const allocationApi = {
  getAllocations: async (workspaceId: string): Promise<SubjectAllocationResponse[]> => {
    const params = { workspace_id: workspaceId };
    const response = await apiClient.get<SubjectAllocationResponse[]>('/allocations', { params });
    return response.data;
  },
  
  createOrUpdate: async (data: SubjectAllocationRequest): Promise<SubjectAllocationResponse> => {
    const response = await apiClient.post<SubjectAllocationResponse>('/allocations', data);
    return response.data;
  },

  finalize: async (workspaceId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/allocations/finalize', { workspace_id: workspaceId });
    return response.data;
  }
};
