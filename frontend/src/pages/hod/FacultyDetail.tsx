import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { preferencesApi, allocationApi, academicApi } from '@/api/index';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface PreferenceItem {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  class_type: string;
  course_type: string;
  semester: number;
  theory_hours: number;
  practical_hours: number;
  decision: string;
  sections: string[];
}

interface FacultyInfo {
  id: number;
  name: string;
  erp_id: string;
  designation: string;
}

interface AllocationRow {
  preference_item_id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  course_type: string;
  class_type: string;
  semester: number;
  approval: 'PENDING' | 'APPROVED' | 'REJECTED';
  section: string;
  valid_sections: string[];
  role: string;
  theory_hours: number;
  lab_hours: number;
  total_hours: number;
}

export default function FacultyDetailModal({ facultyId, onClose }: { facultyId: number; onClose: () => void }) {
  const { session } = useAuth();
  const [faculty, setFaculty] = useState<FacultyInfo | null>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hourCap, setHourCap] = useState(16);
  const [totalAllocated, setTotalAllocated] = useState(0);

  useEffect(() => {
    if (!facultyId) return;
    loadData();
  }, [facultyId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load faculty info
      const facResp = await apiClient.get(`/faculty/detail/${facultyId}`);
      setFaculty(facResp.data.faculty);
      setPreferences(facResp.data.preferences);
      setHourCap(facResp.data.hour_cap || 16);
      
      // Initialize allocations from preferences
      const initAlloc: AllocationRow[] = (facResp.data.preferences as PreferenceItem[]).map((p: PreferenceItem) => ({
        preference_item_id: p.id,
        subject_id: p.subject_id,
        subject_name: p.subject_name,
        subject_code: p.subject_code,
        course_type: p.course_type || 'CORE',
        class_type: p.class_type,
        semester: p.semester,
        approval: (p.decision === 'APPROVED' ? 'APPROVED' : p.decision === 'DENIED' ? 'REJECTED' : 'PENDING') as AllocationRow['approval'],
        section: '',
        valid_sections: p.sections || [],
        role: 'Incharge-1',
        theory_hours: p.theory_hours || 0,
        lab_hours: p.practical_hours || 0,
        total_hours: (p.theory_hours || 0) + (p.practical_hours || 0),
      }));
      
      // Merge with existing allocations if available
      if (facResp.data.allocations) {
        for (const existingAlloc of facResp.data.allocations) {
          const idx = initAlloc.findIndex(a => a.subject_id === existingAlloc.subject_id);
          if (idx >= 0) {
            initAlloc[idx] = { ...initAlloc[idx], ...existingAlloc };
          }
        }
      }
      
      setAllocations(initAlloc);
      calcTotal(initAlloc);
      
    } catch {
      toast.error('Failed to load faculty details.');
    } finally {
      setIsLoading(false);
    }
  };

  const calcTotal = (allocs: AllocationRow[]) => {
    const total = allocs.filter(a => a.approval === 'APPROVED').reduce((sum, a) => sum + a.total_hours, 0);
    setTotalAllocated(total);
  };

  const updateAllocation = (idx: number, field: keyof AllocationRow, value: string | number) => {
    setAllocations(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] } as AllocationRow;
      if (field === 'theory_hours' || field === 'lab_hours') {
        (row as any)[field] = Number(value);
        row.total_hours = (field === 'theory_hours' ? Number(value) : row.theory_hours) + 
                          (field === 'lab_hours' ? Number(value) : row.lab_hours);
      } else {
        (row as any)[field] = value;
      }
      updated[idx] = row;
      calcTotal(updated);
      return updated;
    });
  };

  const saveAllocations = async () => {
    const approved = allocations.filter(a => a.approval === 'APPROVED');
    const newTotal = approved.reduce((s, a) => s + a.total_hours, 0);
    if (newTotal > hourCap) {
      toast.error(`Allocation exceeds hour cap: ${newTotal} / ${hourCap} hours.`);
      return;
    }
    try {
      await apiClient.post(`/api/faculty/${facultyId}/allocations`, {
        allocations: allocations.map(a => ({
          subject_id: a.subject_id,
          approval: a.approval,
          section: a.section,
          role: a.role,
          theory_hours: a.theory_hours,
          lab_hours: a.lab_hours,
        })),
      });
      toast.success('Allocations saved successfully.');
    } catch {
      toast.error('Failed to save allocations.');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px' }}>
        <div className="skeleton" style={{ height: 48, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  if (!faculty) {
    return (
      <div className="empty-state card card-body">
        <div className="empty-state-icon">⚠️</div>
        <h3 className="empty-state-title">Faculty Not Found</h3>
      </div>
    );
  }

  const remaining = hourCap - totalAllocated;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px'
    }}>
      <div className="animate-slide-up" style={{
        background: '#F8FAFC', borderRadius: '16px', width: '100%', maxWidth: '1000px',
        maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Close Button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'white', border: '1px solid #E2E8F0', borderRadius: '50%',
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '16px', color: '#64748B', zIndex: 10
        }}>
          ✕
        </button>

      {/* Faculty Info Header */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>{faculty.name}</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>{faculty.designation} · Employee ID: {faculty.erp_id}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '12px 20px', borderRadius: '12px', background: remaining >= 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${remaining >= 0 ? '#BBF7D0' : '#FECACA'}` }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: remaining >= 0 ? '#16A34A' : '#DC2626' }}>
                {totalAllocated} / {hourCap}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                {remaining >= 0 ? `${remaining} hours remaining` : `Exceeds by ${-remaining} hours`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <div style={{ padding: '20px 20px 12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Subject Preferences & Allocations</h3>
          <p style={{ fontSize: '12px', color: '#64748B' }}>Review submitted preferences, approve/reject, and allocate section, role, and hours.</p>
        </div>
        
        {allocations.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px' }}>
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">No Preferences Submitted</h3>
            <p className="empty-state-desc">This faculty has not yet submitted subject preferences.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Semester</th>
                <th style={thStyle}>Course Type</th>
                <th style={thStyle}>Class Type</th>
                <th style={thStyle}>Approval</th>
                <th style={thStyle}>Section</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Theory Hrs</th>
                <th style={thStyle}>Lab Hrs</th>
                <th style={thStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a, idx) => (
                <tr key={a.subject_id} style={{ borderBottom: '1px solid #F1F5F9', background: a.approval === 'REJECTED' ? '#FEF2F2' : 'white' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#0F172A', maxWidth: '200px' }}>{a.subject_name}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748B' }}>{a.subject_code}</td>
                  <td style={tdStyle}>{a.semester}</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                      background: a.course_type.toUpperCase().includes('CORE') ? '#FEF3C7' : a.course_type.toUpperCase().includes('ELECTIVE') ? '#DBEAFE' : '#F0FDF4',
                      color: a.course_type.toUpperCase().includes('CORE') ? '#92400E' : a.course_type.toUpperCase().includes('ELECTIVE') ? '#1E40AF' : '#166534'
                    }}>
                      {a.course_type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '11px', fontWeight: 700 }}>
                      {a.class_type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <select value={a.approval} onChange={e => updateAllocation(idx, 'approval', e.target.value)}
                      style={{ ...selectStyle, color: a.approval === 'APPROVED' ? '#16A34A' : a.approval === 'REJECTED' ? '#DC2626' : '#64748B' }}>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Yes</option>
                      <option value="REJECTED">No</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select value={a.section} onChange={e => updateAllocation(idx, 'section', e.target.value)} style={selectStyle} disabled={a.approval !== 'APPROVED'}>
                      <option value="">—</option>
                      {a.valid_sections.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select value={a.role} onChange={e => updateAllocation(idx, 'role', e.target.value)} style={selectStyle} disabled={a.approval !== 'APPROVED'}>
                      <option value="Incharge-1">Incharge-1</option>
                      <option value="Incharge-2">Incharge-2</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select value={a.theory_hours} onChange={e => updateAllocation(idx, 'theory_hours', e.target.value)} style={selectStyle} disabled={a.approval !== 'APPROVED'}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select value={a.lab_hours} onChange={e => updateAllocation(idx, 'lab_hours', e.target.value)} style={selectStyle} disabled={a.approval !== 'APPROVED'}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: '#002147' }}>{a.total_hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
        <button onClick={saveAllocations}
          style={{
            padding: '12px 32px', borderRadius: '10px', border: 'none',
            background: '#002147', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer'
          }}>
          💾 Save Allocations
        </button>
      </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700,
  color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px', color: '#475569', fontSize: '13px',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: '6px', border: '1px solid #E2E8F0',
  fontSize: '12px', fontWeight: 600, background: 'white', cursor: 'pointer', minWidth: '70px',
};
