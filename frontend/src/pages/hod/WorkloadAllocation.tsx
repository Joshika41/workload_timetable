import { useState, useEffect } from 'react';
import { workloadApi, academicApi } from '@/api/index';
import { toast } from 'sonner';
import ProgressSphere from '@/components/ProgressSphere';

interface Props { workspaceId: string; wsInfo: any; onRefresh: () => void; }

export default function WorkloadAllocation({ workspaceId, wsInfo, onRefresh }: Props) {
  const [workload, setWorkload] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const loadWorkload = () => {
    setIsLoading(true);
    workloadApi.getFacultyWorkload(workspaceId)
      .then(setWorkload)
      .catch(() => toast.error('Failed to load workload data'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadWorkload(); }, [workspaceId]);

  const progress = wsInfo?.progress_percent || 0;
  const canFinalize = progress === 100 && !wsInfo?.is_finalized;

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await academicApi.finalizeWorkspace(workspaceId);
      toast.success('Workload finalized! ✅');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Finalization failed');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const blob = await workloadApi.exportPdf(workspaceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workload_${workspaceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF export failed. Make sure the semester is finalized.');
    }
  };

  const totalTheory = workload.reduce((s, f) => s + (f.total_theory || 0), 0);
  const totalPractical = workload.reduce((s, f) => s + (f.total_practical || 0), 0);

  return (
    <div className="animate-fade-in">
      {/* Top Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Workload Allocation Matrix</h3>
          <p style={{ fontSize: '12.5px', color: '#64748B' }}>Live workload summary for all faculty. Edit any row to adjust hours, then finalize.</p>
        </div>
        <ProgressSphere percent={progress} size={90} />
      </div>

      {/* Table */}
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />
        ))
      ) : workload.length === 0 ? (
        <div className="empty-state card card-body">
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <h3 className="empty-state-title">No Allocations Yet</h3>
          <p className="empty-state-desc">Submit allocations in the Preference Management tab to see the workload matrix here.</p>
        </div>
      ) : (
        <>
          <div className="erp-table-container" style={{ marginBottom: '20px' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>S.No</th>
                  <th>Faculty Name</th>
                  <th>Designation</th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Class / Section</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Theory</th>
                  <th style={{ textAlign: 'right' }}>Practical</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((fac: any, fi: number) =>
                  (fac.allocations || []).map((alloc: any, ai: number) => {
                    const rowId = alloc.id;
                    const isEditing = editingRow === rowId;

                    return (
                      <tr key={`${fi}-${ai}`}>
                        {ai === 0 && (
                          <>
                            <td rowSpan={(fac.allocations || []).length} style={{ fontWeight: 700, color: '#64748B', textAlign: 'center' }}>
                              {fi + 1}
                            </td>
                            <td rowSpan={(fac.allocations || []).length} style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                              {fac.faculty_name}
                              {fac.is_dummy && <span className="sample-badge" style={{ marginLeft: '4px' }}>Sample</span>}
                            </td>
                            <td rowSpan={(fac.allocations || []).length} style={{ color: '#475569', fontSize: '12px' }}>
                              {fac.designation}
                            </td>
                          </>
                        )}
                        <td style={{ fontWeight: 600 }}>{alloc.subject_name}</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>{alloc.subject_code}</td>
                        <td>
                          <span className="chip chip-submitted">{alloc.class_name} / Sec {alloc.section_name}</span>
                        </td>
                        <td>
                          <span className={`chip ${alloc.role === 'MAIN' ? 'chip-core' : 'chip-elective'}`}>
                            {alloc.role === 'MAIN' ? 'Main' : alloc.role === 'IN2' ? 'IN-2' : alloc.role}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {isEditing ? (
                            <input type="number" style={{ width: 60, padding: '4px', border: '1px solid #CBD5E1', borderRadius: 6, textAlign: 'right', fontSize: 13 }}
                              value={editValues.theory_hours ?? alloc.theory_hours}
                              onChange={e => setEditValues((p: any) => ({ ...p, theory_hours: Number(e.target.value) }))} />
                          ) : `${alloc.theory_hours}h`}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {isEditing ? (
                            <input type="number" style={{ width: 60, padding: '4px', border: '1px solid #CBD5E1', borderRadius: 6, textAlign: 'right', fontSize: 13 }}
                              value={editValues.practical_hours ?? alloc.practical_hours}
                              onChange={e => setEditValues((p: any) => ({ ...p, practical_hours: Number(e.target.value) }))} />
                          ) : `${alloc.practical_hours}h`}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#002147' }}>
                          {isEditing
                            ? `${(editValues.theory_hours ?? alloc.theory_hours) + (editValues.practical_hours ?? alloc.practical_hours)}h`
                            : `${alloc.theory_hours + alloc.practical_hours}h`}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn btn-success btn-sm" onClick={async () => {
                                try {
                                  await import('@/api/client').then(({ apiClient }) =>
                                    apiClient.patch(`/allocations/components/${rowId}`, editValues));
                                  toast.success('Updated');
                                  setEditingRow(null);
                                  loadWorkload();
                                } catch { toast.error('Update failed'); }
                              }}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingRow(null)}>✕</button>
                            </div>
                          ) : (
                            <button className="btn btn-outline btn-sm" onClick={() => {
                              setEditingRow(rowId);
                              setEditValues({ theory_hours: alloc.theory_hours, practical_hours: alloc.practical_hours });
                            }}>Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Totals Row */}
                <tr style={{ background: '#EFF6FF', fontWeight: 800 }}>
                  <td colSpan={7} style={{ textAlign: 'right', color: '#002147', padding: '12px 16px' }}>
                    Department Total
                  </td>
                  <td style={{ textAlign: 'right', color: '#002147', padding: '12px 16px' }}>{totalTheory}h</td>
                  <td style={{ textAlign: 'right', color: '#002147', padding: '12px 16px' }}>{totalPractical}h</td>
                  <td style={{ textAlign: 'right', color: '#002147', padding: '12px 16px' }}>{totalTheory + totalPractical}h</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Finalize Section */}
          <div className="finalize-section">
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Finalize & Export</h4>
              <p style={{ fontSize: '12px', color: '#64748B' }}>
                {wsInfo?.is_finalized
                  ? '🔒 This workload is finalized. Export PDF or reopen to edit.'
                  : canFinalize
                  ? '✅ All faculty allocated — ready to finalize!'
                  : `⚠️ ${100 - progress}% of faculty still pending allocation.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {wsInfo?.is_finalized && (
                <button className="btn btn-outline" onClick={handleExportPDF}>📥 Export PDF</button>
              )}
              <button
                className="btn btn-gold btn-lg"
                disabled={!canFinalize || isFinalizing || wsInfo?.is_finalized}
                onClick={handleFinalize}
              >
                {wsInfo?.is_finalized ? '🔒 Finalized' : isFinalizing ? 'Finalizing...' : '🏁 Finalize Workload'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
