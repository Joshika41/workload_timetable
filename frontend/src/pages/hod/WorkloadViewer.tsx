import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi, workloadApi } from '@/api/index';
import { toast } from 'sonner';
import ProgressSphere from '@/components/ProgressSphere';

export default function WorkloadViewer() {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWs, setExpandedWs] = useState<string | null>(null);
  const [workloadData, setWorkloadData] = useState<Record<string, any[]>>({});

  const ctx = session?.context;

  useEffect(() => {
    if (!ctx) return;
    academicApi.getWorkspacesByContext(ctx.programmeId, ctx.semesterType)
      .then(setWorkspaces)
      .catch(() => toast.error('Failed to load workspaces'))
      .finally(() => setIsLoading(false));
  }, [ctx?.programmeId, ctx?.semesterType]);

  const handleExpand = async (wsId: string) => {
    if (expandedWs === wsId) { setExpandedWs(null); return; }
    setExpandedWs(wsId);
    if (!workloadData[wsId]) {
      try {
        const data = await workloadApi.getFacultyWorkload(wsId);
        setWorkloadData(prev => ({ ...prev, [wsId]: data }));
      } catch {
        toast.error('Failed to load workload for this semester');
      }
    }
  };

  const handleExport = async (wsId: string) => {
    try {
      const blob = await workloadApi.exportPdf(wsId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `workload_sem_${wsId}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF export failed — ensure this semester is finalized');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Workload Viewer</h2>
          <p className="page-subtitle">Quick read-only view of finalized workloads for each semester. Expand a semester to see details.</p>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 14 }} />)
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workspaces.map(ws => {
            const isFinalized = ws.workflow_state === 'FINALIZED';
            const isExpanded = expandedWs === ws.workspace_id;
            const data = workloadData[ws.workspace_id];

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
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>Semester {ws.semester}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {isFinalized ? `Finalized · ${ws.allocated_count} faculty allocated` : 'Not finalized yet'}
                    </div>
                  </div>
                  <ProgressSphere percent={ws.progress_percent} size={56} strokeWidth={5} />
                  {isFinalized && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); handleExport(ws.workspace_id); }}>
                        📥 PDF
                      </button>
                      <span style={{ fontSize: '18px', color: '#94A3B8' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  )}
                  {!isFinalized && (
                    <span className="chip chip-not-started">No workload generated yet</span>
                  )}
                </div>

                {isExpanded && data && (
                  <div style={{ borderTop: '1px solid #E2E8F0', overflow: 'auto' }}>
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Faculty</th>
                          <th>Designation</th>
                          <th style={{ textAlign: 'right' }}>Theory</th>
                          <th style={{ textAlign: 'right' }}>Practical</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((f: any) => (
                          <tr key={f.faculty_id}>
                            <td style={{ fontWeight: 600 }}>{f.faculty_name}</td>
                            <td style={{ color: '#64748B', fontSize: '12px' }}>{f.designation}</td>
                            <td style={{ textAlign: 'right' }}>{f.total_theory}h</td>
                            <td style={{ textAlign: 'right' }}>{f.total_practical}h</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#002147' }}>
                              {f.total_theory + f.total_practical}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
