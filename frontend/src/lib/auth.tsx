import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { authApi } from '@/api/index';
import { toast } from 'sonner';

export interface ERPContext {
  departmentId: number;
  departmentName: string;
  institutionId: number;
  institutionName: string;
  designation: string;
  erpId: string;
  programmeId: number;
  programmeName: string;
  programmeType: string;
  semesterType: 'ODD' | 'EVEN';
  academicYear: string;
}

export interface ERPSession {
  token: string;
  role: 'HOD' | 'FACULTY' | 'ERP_COORDINATOR' | 'MASTER_ADMIN';
  name: string;
  userId: number;
  facultyProfileId: number | null;
  context: ERPContext;
}

interface AuthContextType {
  session: ERPSession | null;
  isLoading: boolean;
  demoLogin: (params: Record<string, unknown>) => Promise<void>;
  realLogin: (username: string, password?: string) => Promise<void>;
  logOut: () => void;
  updateContext: (ctx: Partial<ERPContext>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Legacy compat - old code may check these
export type { AuthContextType };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ERPSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const stored = localStorage.getItem('erp_session');
    if (token && stored) {
      try {
        const s = JSON.parse(stored) as ERPSession;
        setSession(s);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('erp_session');
      }
    }
    setIsLoading(false);
  }, []);

  const demoLogin = async (_params: Record<string, unknown>) => {
    // legacy compat — no-op
  };

  const realLogin = async (username: string, password: string = '123456') => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await authApi.login(formData);

      const newSession: ERPSession = {
        token: response.access_token,
        role: response.role as ERPSession['role'],
        name: response.name,
        userId: response.user_id || 0,
        facultyProfileId: response.faculty_profile_id || null,
        context: {
          departmentId: response.department_id || 0,
          departmentName: response.department_name || '',
          institutionId: response.institution_id || 0,
          institutionName: response.institution_name || '',
          designation: response.designation || '',
          erpId: response.erp_id || '',
          programmeId: 0,
          programmeName: '',
          programmeType: '',
          semesterType: 'ODD',
          academicYear: '2026-27',
        },
      };

      setSession(newSession);
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('erp_session', JSON.stringify(newSession));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.access_token}`;

      toast.success(`Welcome, ${newSession.name}!`);

      if (response.role === 'HOD' || response.role === 'ERP_COORDINATOR') {
        navigate('/hod');
      } else {
        navigate('/faculty');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: any } } };
      let msg = 'Login failed. Please try again.';
      const detail = axiosErr.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg).join(', ');
      }
      toast.error(msg);
      throw err;
    }
  };

  const logOut = () => {
    setSession(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('erp_session');
    delete apiClient.defaults.headers.common['Authorization'];
    navigate('/');
    toast.info('Logged out successfully.');
  };

  const updateContext = (newCtx: Partial<ERPContext>) => {
    if (!session) return;
    const updatedSession = { ...session, context: { ...session.context, ...newCtx } };
    setSession(updatedSession);
    localStorage.setItem('erp_session', JSON.stringify(updatedSession));
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, demoLogin, realLogin, logOut, updateContext }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Legacy compat aliases
export const useSession = useAuth;
