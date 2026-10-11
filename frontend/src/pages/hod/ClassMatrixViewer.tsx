import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/index';
import { toast } from 'sonner';
import ClassWiseMatrix from './ClassWiseMatrix';

export default function ClassMatrixViewer() {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWs, setExpandedWs] = useState<string | null>(null);

  const ctx = session?.context;

  useEffect(() => {
    if (!ctx) return;
    // Fetch across all programmes (0) for this department
    academicApi.getWorkspacesByContext(0, ctx.semesterType)
      .then(setWorkspaces)
      .catch(() => toast.error('Failed to load workspaces'))
      .finally(() => setIsLoading(false));
  }, [ctx?.semesterType]);

  const handleExpand = (wsId: string) => {
    if (expandedWs === wsId) { setExpandedWs(null); return; }
    setExpandedWs(wsId);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Global Class-Wise Matrix</h2>
          <p className="page-subtitle">View finalized section allocations across all programmes and semesters in your department.</p>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 14 }} />)
      ) : workspaces.length === 0 ? (
        <div className="card card-body empty-state">
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <h3 className="empty-state-title">No Workspaces Found</h3>
          <p className="empty-state-desc">There are no workspaces available for the {ctx?.semesterType} semester in your department.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workspaces.map(ws => {
            const isFinalized = ws.workflow_state === 'FINALIZED';
            const isExpanded = expandedWs === ws.workspace_id;

            return (
              <div key={ws.workspace_id} className="card" style={{ overflow: 'hidden' }}>
                <div
                  onClick={() => isFinalized && handleExpand(ws.workspace_id)}
                  style={{
                    padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px',
                    cursor: isFinalized ? 'pointer' : 'default',
                    background: isExpanded ? '#F0F7FF' : 'white',
                  }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: '12px', background: isFinalized ? '#ECFDF5' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {isFinalized ? '✅' : '⏳'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>
                      {ws.programme_name} - Semester {ws.semester}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {isFinalized ? `Finalized · Click to view matrix` : 'Not finalized yet'}
                    </div>
                  </div>
                  {isFinalized && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '18px', color: '#94A3B8' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  )}
                  {!isFinalized && (
                    <span className="chip chip-not-started">No allocations yet</span>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ padding: '24px', background: 'white', borderTop: '1px solid #E2E8F0' }}>
                    <ClassWiseMatrix workspaceId={ws.workspace_id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
