import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type WorkspaceContextType = {
  activeDepartmentId: number | null;
  setActiveDepartmentId: (id: number | null) => void;
  programType: string;
  setProgramType: (type: string) => void;
  semesterType: string;
  setSemesterType: (type: string) => void;
  activeDepartmentName: string | null;
  setActiveDepartmentName: (name: string | null) => void;
  isAllocationLocked: boolean;
  setIsAllocationLocked: (locked: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Try to load from localStorage to persist across reloads (only on client)
  const [activeDepartmentId, setActiveDepartmentIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('workspace_dept_id');
    return saved ? parseInt(saved, 10) : null;
  });
  const [activeDepartmentName, setActiveDepartmentNameState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('workspace_dept_name') || null;
  });
  const [programType, setProgramTypeState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'UG';
    return localStorage.getItem('workspace_prog') || 'UG';
  });
  const [semesterType, setSemesterTypeState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Odd';
    return localStorage.getItem('workspace_sem') || 'Odd';
  });
  const [isAllocationLocked, setIsAllocationLockedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('workspace_locked') === 'true';
  });

  // Custom setters that also update localStorage (only on client)
  const setActiveDepartmentId = (id: number | null) => {
    setActiveDepartmentIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('workspace_dept_id', id.toString());
      else localStorage.removeItem('workspace_dept_id');
    }
  };

  const setActiveDepartmentName = (name: string | null) => {
    setActiveDepartmentNameState(name);
    if (typeof window !== 'undefined') {
      if (name) localStorage.setItem('workspace_dept_name', name);
      else localStorage.removeItem('workspace_dept_name');
    }
  };

  const setProgramType = (type: string) => {
    setProgramTypeState(type);
    if (typeof window !== 'undefined') localStorage.setItem('workspace_prog', type);
  };

  const setSemesterType = (type: string) => {
    setSemesterTypeState(type);
    if (typeof window !== 'undefined') localStorage.setItem('workspace_sem', type);
  };
  
  const setIsAllocationLocked = (locked: boolean) => {
    setIsAllocationLockedState(locked);
    if (typeof window !== 'undefined') localStorage.setItem('workspace_locked', locked.toString());
  };

  return (
    <WorkspaceContext.Provider value={{
      activeDepartmentId, setActiveDepartmentId,
      activeDepartmentName, setActiveDepartmentName,
      programType, setProgramType,
      semesterType, setSemesterType,
      isAllocationLocked, setIsAllocationLocked
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
