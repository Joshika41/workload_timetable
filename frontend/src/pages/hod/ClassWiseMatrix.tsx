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
                        <th key={`${s.name}-main`} style={{ background: '#002147', color: 'white' }}>Sec {s.name} — Main</th>
                        <th key={`${s.name}-asst`} style={{ background: '#002147', color: 'white' }}>Sec {s.name} — Asst</th>
                      </>
                    ))}
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Total</th>
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Theory</th>
                    <th style={{ textAlign: 'right', background: '#001530', color: 'white' }}>Lab</th>
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
                            <td key={`${sec.name}-main`} className={allocation.main ? 'faculty-cell' : 'unallocated'}>
                              {allocation.main || '—'}
                            </td>
                            <td key={`${sec.name}-asst`} className={allocation.assistant ? 'faculty-cell' : 'unallocated'} style={{ color: '#64748B' }}>
                              {allocation.assistant || '—'}
                            </td>
                          </>
                        );
                      })}
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{subRow.total_hours}h</td>
                      <td style={{ textAlign: 'right' }}>{subRow.theory_hours}h</td>
                      <td style={{ textAlign: 'right' }}>{subRow.lab_hours}h</td>
                    </tr>
                  ))}
                  {/* Footer totals */}
                  <tr className="total-row">
                    <td style={{ fontWeight: 800, color: '#002147' }}>TOTAL</td>
                    {(classBlock.sections || []).map((s: any) => (
                      <>
                        <td key={`${s.name}-main-total`} />
                        <td key={`${s.name}-asst-total`} />
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
