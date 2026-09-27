import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi, workloadApi } from '@/api/index';
import { toast } from 'sonner';

export default function MySubjects() {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [mySubjectsMap, setMySubjectsMap] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const ctx = session?.context;

  useEffect(() => {
    if (!ctx) return;
    setIsLoading(true);
    academicApi.getWorkspacesByContext(ctx.programmeId, ctx.semesterType)
      .then(async (wsList) => {
        setWorkspaces(wsList);
        // Load my subjects for finalized workspaces
        const finalizedWs = wsList.filter((ws: any) => ws.workflow_state === 'FINALIZED');
        const mySubjectResults = await Promise.allSettled(
          finalizedWs.map((ws: any) =>
            workloadApi.getMySubjects(ws.workspace_id).then(data => ({ wsId: ws.workspace_id, data }))
          )
        );
        const map: Record<string, any[]> = {};
        mySubjectResults.forEach(r => {
          if (r.status === 'fulfilled') map[r.value.wsId] = r.value.data;
        });
        setMySubjectsMap(map);
      })
      .catch(() => toast.error('Failed to load your subjects'))
      .finally(() => setIsLoading(false));
  }, [ctx?.programmeId, ctx?.semesterType]);

  if (!ctx) return null;

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = { CORE: 'chip-core', ELECTIVE: 'chip-elective', LAB: 'chip-lab' };
    return map[cat?.toUpperCase()] || 'chip-not-started';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Subjects</h2>
          <p className="page-subtitle">Your finalized subject allocations for each semester. These are confirmed by your HOD.</p>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, marginBottom: 12, borderRadius: 14 }} />)
      ) : (
        workspaces.map(ws => {
          const subjects = mySubjectsMap[ws.workspace_id] || [];
          const isFinalized = ws.workflow_state === 'FINALIZED';
          const totalTheory = subjects.reduce((s: number, sub: any) => s + (sub.theory_hours || 0), 0);
          const totalPractical = subjects.reduce((s: number, sub: any) => s + (sub.practical_hours || 0), 0);

          return (
            <div key={ws.workspace_id} className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '12px', background: isFinalized ? '#ECFDF5' : '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>SEM</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: '#002147', lineHeight: 1 }}>{ws.semester}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Semester {ws.semester}</span>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {isFinalized ? `${subjects.length} subjects allocated` : 'Not yet finalized by HOD'}
                    </div>
                  </div>
                </div>
                {isFinalized && subjects.length > 0 && (
                  <div style={{ display: 'flex', gap: '16px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147' }}>{totalTheory}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Theory</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED' }}>{totalPractical}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Practical</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981' }}>{totalTheory + totalPractical}h</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card-body">
                {!isFinalized ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                    <p style={{ fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
                      Nothing allocated yet — your HOD is still working on this semester.
                    </p>
                    <p style={{ fontSize: '12px', color: '#B45309', marginTop: '4px' }}>
                      Your finalized subjects will appear here once the HOD completes the workload allocation process.
                    </p>
                  </div>
                ) : subjects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                    <p style={{ fontWeight: 600 }}>No subjects have been allocated to you for this semester.</p>
                  </div>
                ) : (
                  <div className="erp-table-container">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Code</th>
                          <th>Category</th>
                          <th>Class / Section</th>
                          <th>Role</th>
                          <th style={{ textAlign: 'right' }}>Theory</th>
                          <th style={{ textAlign: 'right' }}>Practical</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((sub: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: '#0F172A' }}>{sub.subject_name}</td>
                            <td style={{ fontSize: '12px', color: '#64748B' }}>{sub.subject_code}</td>
                            <td><span className={`chip ${getCategoryColor(sub.category)}`}>{sub.category}</span></td>
                            <td><span className="chip chip-submitted">{sub.class_name} / Sec {sub.section_name}</span></td>
                            <td>
                              <span className={`chip ${sub.role === 'MAIN' ? 'chip-core' : 'chip-elective'}`}>
                                {sub.role === 'MAIN' ? 'Main In-charge' : sub.role === 'IN2' ? 'IN-2 / Assist' : sub.role}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{sub.theory_hours}h</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{sub.practical_hours}h</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#002147' }}>
                              {sub.theory_hours + sub.practical_hours}h
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: '#EFF6FF', fontWeight: 800 }}>
                          <td colSpan={5} style={{ color: '#002147', padding: '10px 16px' }}>Semester Total</td>
                          <td style={{ textAlign: 'right', color: '#002147', padding: '10px 16px' }}>{totalTheory}h</td>
                          <td style={{ textAlign: 'right', color: '#002147', padding: '10px 16px' }}>{totalPractical}h</td>
                          <td style={{ textAlign: 'right', color: '#002147', padding: '10px 16px' }}>{totalTheory + totalPractical}h</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
