import { toast } from "sonner";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "./erp-data";
import api from "./api";
import { jwtDecode } from "jwt-decode";

export interface Session {
  username: string; // Used as email
  name: string;
  role: Role;
  department?: string;
  faculty_id?: string;
}

interface AuthValue {
  session: Session | null;
  ready: boolean;
  signIn: (username: string, password: string, role: Role) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  setDepartment: (dept: string) => void;
  departmentLabs: Record<string, boolean>;
  fetchDepartments: () => Promise<void>;
  toggleHasLabs: (dept: string, has_labs: boolean) => Promise<void>;
}

const STORAGE_KEY = "srm-erp-session";
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [departmentLabs, setDepartmentLabs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);


  // Proactive JWT Expiry checking
  useEffect(() => {
    if (!session) return;
    
    const checkExpiry = () => {
      try {
        const token = window.localStorage.getItem("auth_token");
        if (!token) return;
        
        // Very basic JWT decode to get exp
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        const now = Date.now();
        const timeRemaining = exp - now;
        
        // If less than 5 minutes remaining, warn the user
        if (timeRemaining > 0 && timeRemaining < 5 * 60 * 1000) {
          toast.warning("Your session will expire soon. Please save your work.", { id: "jwt-warn" });
        }
      } catch (e) {
        // ignore decoding errors
      }
    };
    
    // Check every minute
    const interval = setInterval(checkExpiry, 60000);
    return () => clearInterval(interval);
  }, [session]);


  const value = useMemo<AuthValue>(
    () => ({
      departmentLabs,
      session,
      ready,
      signIn: async (email, password, role) => {
        try {
          const res = await api.post("/api/auth/login", { 
            email: email, 
            username: email, 
            password: password 
          });
          const token = res.data.access_token;
          
          const payload = jwtDecode<any>(token);
          const backendRole = payload.role.toLowerCase();
          
          if (backendRole !== role.toLowerCase()) {
            return { ok: false, error: `These credentials are not valid for the ${role} portal.` };
          }
          
          const mappedRole = backendRole as Role;          
          const next: Session = { 
            username: email, 
            name: email.split('@')[0],
            role: mappedRole,
            faculty_id: payload.sub
          };
          
          setSession(next);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.localStorage.setItem("auth_token", token);
          return { ok: true };
        } catch (error: any) {
          return { ok: false, error: error.response?.data?.detail || "Invalid email or password." };
        }
      },
      signOut: () => {
        setSession(null);
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem("auth_token");
      },
      fetchDepartments: async () => {
        try {
          if (session?.role === 'admin' || session?.role === 'admin') {
            const res = await api.get("/api/admin/departments");
            if (Array.isArray(res.data)) {
              // Convert array to Record<string, boolean> for backward compatibility
              const labsMap: Record<string, boolean> = {};
              res.data.forEach(d => {
                labsMap[d.name] = d.has_labs || false;
              });
              setDepartmentLabs(labsMap);
            } else {
              setDepartmentLabs(res.data);
            }
          }
        } catch { /* ignore */ }
      },
      toggleHasLabs: async (dept: string, has_labs: boolean) => {
        try {
          await api.put(`/api/admin/departments/${dept}`, { has_labs });
          setDepartmentLabs(prev => ({...prev, [dept]: has_labs}));
        } catch (e: any) {
          console.error(e);
          alert(e.response?.data?.detail || "Failed to update department settings.");
        }
      },
      setDepartment: (department) => {
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, department };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      },
    }),
    [session, ready, departmentLabs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

