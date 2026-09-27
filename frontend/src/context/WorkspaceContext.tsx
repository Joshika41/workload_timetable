import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type CanonicalWorkspace = {
  workspace_id: string;
  department_id: number;
  department_name: string;
  programme_id: number;
  programme_name: string;
  programme_year: number;
  academic_year_id: number;
  academic_year_name: string;
  semester: number;
  semester_type: string;
  workflow_state?: string;
  sections: { id: number; name: string }[];
};

type WorkspaceContextType = {
  activeWorkspace: CanonicalWorkspace | null;
  setActiveWorkspace: (workspace: CanonicalWorkspace | null) => void;
  isAllocationLocked: boolean;
  setIsAllocationLocked: (locked: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<CanonicalWorkspace | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('active_workspace');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAllocationLocked, setIsAllocationLockedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('workspace_locked') === 'true';
  });

  const setActiveWorkspace = (workspace: CanonicalWorkspace | null) => {
    setActiveWorkspaceState(workspace);
    if (typeof window !== 'undefined') {
      if (workspace) localStorage.setItem('active_workspace', JSON.stringify(workspace));
      else localStorage.removeItem('active_workspace');
    }
  };

  const setIsAllocationLocked = (locked: boolean) => {
    setIsAllocationLockedState(locked);
    if (typeof window !== 'undefined') localStorage.setItem('workspace_locked', locked.toString());
  };

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspace, setActiveWorkspace,
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
