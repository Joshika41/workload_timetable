import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { workloadApi } from '@/api/index';
import { toast } from 'sonner';

export default function MySubjects() {
  const { session } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ODD' | 'EVEN'>('ODD');

  useEffect(() => {
    setIsLoading(true);
    // Fetch all subjects across all workspaces
    workloadApi.getMySubjects('')
      .then(data => setSubjects(data))
      .catch(() => toast.error('Failed to load your subjects'))
      .finally(() => setIsLoading(false));
  }, []);

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = { CORE: 'chip-core', ELECTIVE: 'chip-elective', LAB: 'chip-lab' };
    return map[cat?.toUpperCase()] || 'chip-not-started';
  };

  const filteredSubjects = subjects.filter(s => {
    const isOdd = s.semester ? s.semester % 2 !== 0 : true;
    return activeTab === 'ODD' ? isOdd : !isOdd;
  });

  // Group by semester
  const groupedSubjects = filteredSubjects.reduce((acc: Record<number, any[]>, sub) => {
    const sem = sub.semester || 0;
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(sub);
    return acc;
  }, {});

  const sortedSemesters = Object.keys(groupedSubjects).map(Number).sort((a, b) => a - b);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Subjects</h2>
          <p className="page-subtitle">Your subject allocations and preferences across all semesters.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('ODD')}
          style={{
            padding: '12px 32px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'ODD' ? '#002147' : '#F8FAFC',
            color: activeTab === 'ODD' ? 'white' : '#64748B',
            boxShadow: activeTab === 'ODD' ? '0 4px 12px rgba(0,33,71,0.2)' : 'none',
          }}
        >
          ODD Semester
        </button>
        <button
          onClick={() => setActiveTab('EVEN')}
          style={{
            padding: '12px 32px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'EVEN' ? '#002147' : '#F8FAFC',
            color: activeTab === 'EVEN' ? 'white' : '#64748B',
            boxShadow: activeTab === 'EVEN' ? '0 4px 12px rgba(0,33,71,0.2)' : 'none',
          }}
        >
          EVEN Semester
        </button>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, marginBottom: 12, borderRadius: 14 }} />)
      ) : sortedSemesters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: 'white', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>No Subjects Found</h3>
          <p style={{ color: '#64748B', fontWeight: 600 }}>You do not have any submitted preferences or allocations for the {activeTab} semester yet.</p>
        </div>
      ) : (
        sortedSemesters.map(sem => {
          const semSubjects = groupedSubjects[sem];
          const totalTheory = semSubjects.reduce((s: number, sub: any) => s + (sub.allocations || []).reduce((as: number, a: any) => as + (a.assigned_theory || 0), 0), 0);
          const totalPractical = semSubjects.reduce((s: number, sub: any) => s + (sub.allocations || []).reduce((as: number, a: any) => as + (a.assigned_practical || 0), 0), 0);
          
          return (
            <div key={sem} className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header" style={{ background: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '14px', background: '#002147', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,33,71,0.2)' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>SEM</span>
                    <span style={{ fontSize: '22px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{sem || '-'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Semester {sem || 'N/A'} Subjects</span>
                    <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px', fontWeight: 600 }}>
                      {semSubjects.length} subjects in your scope
                    </div>
                  </div>
                </div>
                {totalTheory + totalPractical > 0 && (
                  <div style={{ display: 'flex', gap: '20px', textAlign: 'center', background: 'white', padding: '12px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147' }}>{totalTheory}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Theory Asgn</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED' }}>{totalPractical}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Prac Asgn</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981' }}>{totalTheory + totalPractical}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Total Asgn</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card-body" style={{ padding: '0' }}>
                <div className="erp-table-container" style={{ borderRadius: '0 0 16px 16px', border: 'none' }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Subject Details</th>
                        <th>Programme</th>
                        <th>Requirement</th>
                        <th>Pref. Status</th>
                        <th>Alloc. Status</th>
                        <th>Section</th>
                        <th>Role</th>
                        <th style={{ textAlign: 'right' }}>Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semSubjects.map((sub: any, idx: number) => {
                        const rows = Math.max(1, sub.allocations ? sub.allocations.length : 1);
                        return Array.from({ length: rows }).map((_, allocIdx) => {
                          const alloc = sub.allocations ? sub.allocations[allocIdx] : null;
                          return (
                            <tr key={`${idx}-${allocIdx}`} style={allocIdx > 0 ? { borderTop: 'none' } : {}}>
                              {allocIdx === 0 && (
                                <>
                                  <td rowSpan={rows} style={{ verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px', lineHeight: 1.3 }}>{sub.subject_name}</span>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{sub.subject_code}</span>
                                        <span className={`chip ${getCategoryColor(sub.category)}`} style={{ padding: '2px 8px', fontSize: '10px' }}>{sub.category}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td rowSpan={rows} style={{ verticalAlign: 'top', fontWeight: 600, color: '#475569' }}>
                                    {sub.class_type || 'General'}
                                  </td>
                                  <td rowSpan={rows} style={{ verticalAlign: 'top' }}>
                                    <span style={{ fontWeight: 800, color: '#002147' }}>{sub.required_theory}T + {sub.required_practical}P</span>
                                  </td>
                                  <td rowSpan={rows} style={{ verticalAlign: 'top' }}>
                                    <span className="chip" style={{ background: sub.preference_status === 'APPROVED' ? '#ECFDF5' : '#F8FAFC', color: sub.preference_status === 'APPROVED' ? '#10B981' : '#64748B', fontWeight: 700 }}>
                                      {sub.preference_status || 'NOT_SELECTED'}
                                    </span>
                                  </td>
                                  <td rowSpan={rows} style={{ verticalAlign: 'top' }}>
                                    <span className="chip" style={{ 
                                      background: sub.allocation_status === 'ALLOCATED' || sub.allocation_status === 'FINALIZED' ? '#ECFDF5' : '#FEF2F2', 
                                      color: sub.allocation_status === 'ALLOCATED' || sub.allocation_status === 'FINALIZED' ? '#10B981' : '#DC2626',
                                      fontWeight: 800
                                    }}>
                                      {sub.allocation_status || 'NOT_STARTED'}
                                    </span>
                                  </td>
                                </>
                              )}
                              <td style={{ verticalAlign: 'middle' }}>
                                {alloc ? <span style={{ fontWeight: 800, color: '#0F172A' }}>Sec {alloc.section}</span> : <span style={{ color: '#CBD5E1', fontWeight: 800 }}>—</span>}
                              </td>
                              <td style={{ verticalAlign: 'middle' }}>
                                {alloc ? (
                                  <span className={`chip ${(alloc.role === 'INCHARGE_1' || alloc.role === 'Incharge-1') ? 'chip-core' : 'chip-elective'}`} style={{ fontWeight: 800 }}>
                                    {alloc.role.replace('_', ' ')}
                                  </span>
                                ) : <span style={{ color: '#CBD5E1', fontWeight: 800 }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                {alloc ? (
                                  <span style={{ fontWeight: 900, color: '#002147', fontSize: '15px' }}>
                                    {alloc.assigned_theory}T + {alloc.assigned_practical}P
                                  </span>
                                ) : <span style={{ color: '#CBD5E1', fontWeight: 800 }}>—</span>}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
