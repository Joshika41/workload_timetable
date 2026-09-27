import { apiClient } from './client';
import type { LoginCredentials, AuthResponse } from '../types/auth';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await apiClient.post<AuthResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
  
  demoLogin: async (role: string, departmentId?: number): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/demo-login', { role, department_id: departmentId });
    return response.data;
  }
};
