import { apiClient } from './client';
import type { PreferenceSubmitRequest, PreferenceSubmissionResponse, PreferenceDecisionRequest } from '../types/preferences';

export const preferenceApi = {
  getFacultyPreferences: async (workspaceId: string): Promise<PreferenceSubmissionResponse[]> => {
    const response = await apiClient.get<PreferenceSubmissionResponse[]>('/faculty/preferences', {
      params: { workspace_id: workspaceId }
    });
    return response.data;
  },

  submitPreferences: async (data: PreferenceSubmitRequest): Promise<{ message: string; id: number }> => {
    const response = await apiClient.post<{ message: string; id: number }>('/faculty/preferences', data);
    return response.data;
  },

  getAllPreferences: async (workspaceId: string): Promise<PreferenceSubmissionResponse[]> => {
    const response = await apiClient.get<PreferenceSubmissionResponse[]>('/coordinator/preferences', {
      params: { workspace_id: workspaceId }
    });
    return response.data;
  },

  reviewSubmission: async (submissionId: number, review_status: string): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(
      `/coordinator/preferences/submissions/${submissionId}/review`,
      { review_status }
    );
    return response.data;
  },

  decidePreference: async (itemId: number, data: PreferenceDecisionRequest): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(`/coordinator/preferences/${itemId}`, data);
    return response.data;
  }
};
