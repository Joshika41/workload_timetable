import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/index';
import { toast } from 'sonner';
import ClassWiseMatrix from './ClassWiseMatrix';

export default function ClassMatrixViewer() {
  const { session } = useAuth();
  const ctx = session?.context;

  // Active Term Toggle: Supports ODD (Sem 1, 3, 5) and EVEN (Sem 2, 4, 6) across all programmes & departments
  const [selectedTerm, setSelectedTerm] = useState<'ODD' | 'EVEN'>(
    (ctx?.semesterType as 'ODD' | 'EVEN') || 'ODD'
  );
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWs, setExpandedWs] = useState<string | null>(null);

  const loadWorkspacesForTerm = (term: 'ODD' | 'EVEN') => {
    setIsLoading(true);
    // Fetch across all programmes (0) for this department in the selected term
    academicApi.getWorkspacesByContext(0, term)
      .then(res => {
        setWorkspaces(res || []);
        // Automatically expand the first workspace if none expanded yet
        if (res && res.length > 0 && !expandedWs) {
          setExpandedWs(res[0].workspace_id);
        }
      })
      .catch(() => toast.error(`Failed to load ${term} semester workspaces`))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadWorkspacesForTerm(selectedTerm);
  }, [selectedTerm]);

  const handleExpand = (wsId: string) => {
    if (expandedWs === wsId) { 
      setExpandedWs(null); 
      return; 
    }
    setExpandedWs(wsId);
  };

  return (
    <div className="animate-fade-in">
      {/* Header with Global Term Toggle */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 className="page-title">Global Class-Wise Matrix</h2>
          <p className="page-subtitle">
            View live section allocations, in-charge faculty mappings, and reconciliation status across all programmes and semesters in your department.
          </p>
        </div>

        {/* Global ODD / EVEN Term Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F1F5F9', padding: '5px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', paddingLeft: '8px' }}>
            Academic Term:
          </span>
          <button
            onClick={() => { setSelectedTerm('ODD'); setExpandedWs(null); }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: selectedTerm === 'ODD' ? '#002147' : 'transparent',
              color: selectedTerm === 'ODD' ? 'white' : '#64748B',
              boxShadow: selectedTerm === 'ODD' ? '0 2px 8px rgba(0,33,71,0.2)' : 'none'
            }}
          >
            ODD Semesters (1, 3, 5)
          </button>
          <button
            onClick={() => { setSelectedTerm('EVEN'); setExpandedWs(null); }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: selectedTerm === 'EVEN' ? '#002147' : 'transparent',
              color: selectedTerm === 'EVEN' ? 'white' : '#64748B',
              boxShadow: selectedTerm === 'EVEN' ? '0 2px 8px rgba(0,33,71,0.2)' : 'none'
            }}
          >
            EVEN Semesters (2, 4, 6)
          </button>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12, borderRadius: 14 }} />
        ))
      ) : workspaces.length === 0 ? (
        <div className="card card-body empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>📋</div>
          <h3 className="empty-state-title" style={{ fontSize: '18px', color: '#002147', fontWeight: 800 }}>
            No Workspaces Found for {selectedTerm} Semesters
          </h3>
          <p className="empty-state-desc" style={{ color: '#64748B', maxWidth: '480px', margin: '4px auto 0' }}>
            There are no active curriculum workspaces registered for {selectedTerm} semester types in this department. Switch to {selectedTerm === 'ODD' ? 'EVEN' : 'ODD'} to view other cohorts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {workspaces.map(ws => {
            const isFinalized = ws.workflow_state === 'FINALIZED';
            const isExpanded = expandedWs === ws.workspace_id;

            return (
              <div 
                key={ws.workspace_id} 
                className="card" 
                style={{ 
                  overflow: 'hidden', 
                  border: isExpanded ? '1.5px solid #002147' : '1px solid #E2E8F0',
                  boxShadow: isExpanded ? '0 6px 20px rgba(0,33,71,0.08)' : '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  onClick={() => handleExpand(ws.workspace_id)}
                  style={{
                    padding: '18px 24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    cursor: 'pointer',
                    background: isExpanded ? '#F0F7FF' : 'white',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: '12px', 
                    background: isFinalized ? '#ECFDF5' : '#EFF6FF', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '22px', 
                    flexShrink: 0 
                  }}>
                    {isFinalized ? '✅' : '📝'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#002147', fontSize: '16px' }}>
                        {ws.programme_name} - Semester {ws.semester}
                      </span>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        background: selectedTerm === 'ODD' ? '#FEF3C7' : '#E0E7FF',
                        color: selectedTerm === 'ODD' ? '#92400E' : '#3730A3'
                      }}>
                        {selectedTerm}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                      {isFinalized ? `Finalized & Locked · Click to collapse / expand live class matrix` : `${ws.workflow_state} · Click to view live section matrix & hours`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className={`chip ${isFinalized ? 'chip-finalized' : 'chip-in-progress'}`}>
                      {ws.workflow_state}
                    </span>
                    <span style={{ fontSize: '18px', color: '#002147', fontWeight: 800 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
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
