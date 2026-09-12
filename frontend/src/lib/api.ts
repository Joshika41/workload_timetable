import axios from 'axios';
import { toast } from 'sonner';

const API_URL = '';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('srm-erp-session'); // Clear contextual session to prevent redirect loops
        if (window.location.pathname !== '/') {
          toast.error("Session Expired. Please log in again to protect your data.");
          window.location.href = '/';
        }
      }
      
      // Extract detailed API error message
      if (error.response.data && error.response.data.detail) {
        // Handle array of details (e.g. pydantic validation errors)
        if (Array.isArray(error.response.data.detail)) {
            error.message = error.response.data.detail.map((e: any) => e.msg).join(", ");
        } else if (typeof error.response.data.detail === 'string') {
            error.message = error.response.data.detail;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
