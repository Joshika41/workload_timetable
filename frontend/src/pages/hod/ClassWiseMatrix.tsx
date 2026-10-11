import { useState, useEffect } from 'react';
import { workloadApi } from '@/api/index';
import { toast } from 'sonner';

interface Props { workspaceId: string; }

export default function ClassWiseMatrix({ workspaceId }: Props) {
  const [matrix, setMatrix] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    workloadApi.getClassMatrix(workspaceId)
      .then(setMatrix)
      .catch(() => toast.error('Failed to load class-wise matrix'))
      .finally(() => setIsLoading(false));
  }, [workspaceId]);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h3 className="page-title" style={{ fontSize: '18px' }}>Class-wise Matrix</h3>
          <p className="page-subtitle">Auto-generated from allocations. Updates instantly when allocations change.</p>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 200, marginBottom: 16, borderRadius: 16 }} />
        ))
      ) : matrix.length === 0 ? (
        <div className="empty-state card card-body">
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <h3 className="empty-state-title">Matrix Not Available</h3>
          <p className="empty-state-desc">The class-wise matrix is built automatically from workload allocations. Submit some allocations in the Preference Management tab to see the matrix here.</p>
        </div>
      ) : (
        matrix.map((classBlock: any) => (
          <div key={classBlock.class_name} className="matrix-block">
            <div className="matrix-block-header">
              <span className="matrix-block-title">{classBlock.class_name}</span>
              <div className="matrix-block-sections">
                {(classBlock.sections || []).map((s: any) => (
                  <span key={s.name} className="matrix-section-chip">
                    {s.name} — {s.advisor || 'No Advisor'}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="erp-table matrix-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 180, background: '#002147', color: 'white' }}>Subject</th>
                    {(classBlock.sections || []).map((s: any) => (
                      <>
                        <th key={`${s.name}-in1`} style={{ background: '#002147', color: 'white' }}>Sec {s.name} — Incharge-1</th>
                        <th key={`${s.name}-in2`} style={{ background: '#002147', color: 'white' }}>Sec {s.name} — Incharge-2</th>
                      </>
                    ))}
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Class Total</th>
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Required Total</th>
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Difference</th>
                    <th style={{ textAlign: 'center', background: '#001530', color: 'white' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(classBlock.subjects || []).map((subRow: any) => (
                    <tr key={subRow.subject_code}>
                      <td className="subject-cell">
                        <div style={{ fontWeight: 700 }}>{subRow.subject_short || subRow.subject_code}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>{subRow.subject_name}</div>
                      </td>
                      {(classBlock.sections || []).map((sec: any) => {
                        const allocation = subRow.sections?.[sec.name] || {};
                        return (
                          <>
                            <td key={`${sec.name}-in1`} className={allocation['Incharge-1'] ? 'faculty-cell' : 'unallocated'}>
                              {allocation['Incharge-1']?.name || '—'} 
                              {allocation['Incharge-1'] && (
                                <div style={{ fontSize: '10px', color: '#64748B' }}>
                                  T:{allocation['Incharge-1'].theory} L:{allocation['Incharge-1'].lab} Tot:{allocation['Incharge-1'].total}
                                </div>
                              )}
                            </td>
                            <td key={`${sec.name}-in2`} className={allocation['Incharge-2'] ? 'faculty-cell' : 'unallocated'} style={{ color: '#64748B' }}>
                              {allocation['Incharge-2']?.name || '—'}
                              {allocation['Incharge-2'] && (
                                <div style={{ fontSize: '10px', color: '#64748B' }}>
                                  T:{allocation['Incharge-2'].theory} L:{allocation['Incharge-2'].lab} Tot:{allocation['Incharge-2'].total}
                                </div>
                              )}
                            </td>
                          </>
                        );
                      })}
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{subRow.allocated_total}h</td>
                      <td style={{ textAlign: 'right' }}>{subRow.required_total}h</td>
                      <td style={{ textAlign: 'right', color: subRow.difference !== 0 ? '#DC2626' : '#16A34A' }}>{subRow.difference}h</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          background: subRow.status === 'RECONCILED' ? '#F0FDF4' : '#FEF2F2',
                          color: subRow.status === 'RECONCILED' ? '#16A34A' : '#DC2626'
                        }}>
                          {subRow.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Footer totals */}
                  <tr className="total-row">
                    <td style={{ fontWeight: 800, color: '#002147' }}>TOTAL</td>
                    {(classBlock.sections || []).map((s: any) => (
                      <>
                        <td key={`${s.name}-in1-total`} />
                        <td key={`${s.name}-in2-total`} />
                      </>
                    ))}
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#002147' }}>{classBlock.total_hours}h</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#002147' }}>{classBlock.total_theory}h</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#002147' }}>{classBlock.total_lab}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
