import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/api/client';
import { preferencesApi } from '@/api/index';
import { toast } from 'sonner';

interface SemesterGroup {
  semester_number: number;
  programme_name: string;
  programme_id: number;
  subjects: SubjectRow[];
  is_submitted?: boolean;
  selected_subject_ids?: number[];
  is_finalized?: boolean;
}

interface SubjectRow {
  id: number;
  course_code: string;
  course_name: string;
  category: string;
  theory_hours: number;
  practical_hours: number;
  credits: number;
  class_type: string;
  is_optional: boolean;
}

type SemType = 'ODD' | 'EVEN';

export default function FacultyHome() {
  const { session } = useAuth();
  const [semType, setSemType] = useState<SemType | null>(null);
  const [semesterGroups, setSemesterGroups] = useState<SemesterGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSem, setExpandedSem] = useState<number | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<number, number[]>>({});
  const [submittedPrefs, setSubmittedPrefs] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ctx = session?.context;

  useEffect(() => {
    if (semType && ctx) {
      loadSemesters(semType);
    }
  }, [semType]);

  const loadSemesters = async (st: SemType) => {
    setIsLoading(true);
    try {
      const resp = await apiClient.get(`/faculty/my-semesters`, { params: { semester_type: st } });
      const groups: SemesterGroup[] = resp.data;
      setSemesterGroups(groups);
      
      const newSelectedMap: Record<number, number[]> = {};
      const newSubmittedPrefs: Record<number, boolean> = {};
      
      groups.forEach(g => {
        if (g.selected_subject_ids) {
          newSelectedMap[g.semester_number] = g.selected_subject_ids;
        }
        if (g.is_submitted) {
          newSubmittedPrefs[g.semester_number] = true;
        }
      });
      
      setSelectedMap(newSelectedMap);
      setSubmittedPrefs(newSubmittedPrefs);
      
    } catch {
      toast.error('Failed to load semesters.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSubject = (semNum: number, subId: number) => {
    const current = selectedMap[semNum] || [];
    if (current.includes(subId)) {
      setSelectedMap(p => ({ ...p, [semNum]: current.filter(id => id !== subId) }));
    } else {
      setSelectedMap(p => ({ ...p, [semNum]: [...current, subId] }));
    }
  };

  const handleSubmit = async (semGroup: SemesterGroup) => {
    const selected = selectedMap[semGroup.semester_number] || [];
    
    // Validation: at least 1 core and 1 elective
    const subjects = semGroup.subjects;
    const selectedSubs = subjects.filter(s => selected.includes(s.id));
    const hasCore = selectedSubs.some(s => s.category.toUpperCase() === 'CORE');
    const hasElective = selectedSubs.some(s => ['ELECTIVE', 'DISCIPLINE_ELECTIVE'].includes(s.category.toUpperCase()));
    
    if (!hasCore) {
      toast.error(`Please select at least one Core subject for Semester ${semGroup.semester_number}.`);
      return;
    }
    if (!hasElective) {
      toast.error(`Please select at least one Elective subject for Semester ${semGroup.semester_number}.`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await apiClient.post('/faculty/preferences/submit', {
        semester_number: semGroup.semester_number,
        programme_id: semGroup.programme_id,
        semester_type: semType,
        subject_ids: selected,
      });
      toast.success(`Preferences submitted for Semester ${semGroup.semester_number}! ✅`);
      setSubmittedPrefs(p => ({ ...p, [semGroup.semester_number]: true }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || 'Failed to submit preferences.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ctx) return null;

  // If no sem type selected yet, show the ODD/EVEN chooser
  if (!semType) {
    return (
      <div className="animate-fade-in">
        <div className="welcome-banner" style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Faculty Portal
          </p>
          <h1 className="welcome-title">Welcome, {session?.name}!</h1>
          <p className="welcome-subtitle">
            {ctx.departmentName} · {ctx.institutionName} · AY {ctx.academicYear}
          </p>
          <div className="welcome-meta">
            <span className="welcome-chip">🏛️ {ctx.institutionName}</span>
            <span className="welcome-chip">📋 {ctx.departmentName}</span>
            <span className="welcome-chip">👤 {ctx.designation}</span>
          </div>
        </div>

        <div className="page-header">
          <div>
            <h2 className="page-title">Subject Preferences</h2>
            <p className="page-subtitle">Choose a semester type to begin selecting your preferred subjects.</p>
          </div>
        </div>

        {/* Preference Status */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>📝 Your Status</h3>
          <p style={{ fontSize: '13px', color: '#64748B' }}>Preference Not Submitted — Please select a semester type below to begin.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '600px' }}>
          <button onClick={() => setSemType('ODD')} style={semCardStyle}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📚</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147', marginBottom: '6px' }}>ODD Semester</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Semesters 1, 3, 5</div>
          </button>
          <button onClick={() => setSemType('EVEN')} style={semCardStyle}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📖</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147', marginBottom: '6px' }}>EVEN Semester</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Semesters 2, 4, 6</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="welcome-banner" style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Faculty Portal
        </p>
        <h1 className="welcome-title">Welcome, {session?.name}!</h1>
        <p className="welcome-subtitle">
          {ctx.departmentName} · {ctx.institutionName} · {semType} Semesters · AY {ctx.academicYear}
        </p>
        <div className="welcome-meta">
          <span className="welcome-chip">🏛️ {ctx.institutionName}</span>
          <span className="welcome-chip">📋 {ctx.departmentName}</span>
          <span className="welcome-chip">👤 {ctx.designation}</span>
        </div>
      </div>

      {/* Back button */}
      <button onClick={() => { setSemType(null); setSemesterGroups([]); setExpandedSem(null); }}
        style={{ background: 'none', border: 'none', color: '#002147', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        ← Back to Semester Type
      </button>

      {/* Rules Panel */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', marginBottom: '8px' }}>📋 Selection Rules</h4>
        <ul style={{ fontSize: '12px', color: '#78350F', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
          <li><strong>Rule 1:</strong> Select at least one <strong>Core</strong> subject per semester.</li>
          <li><strong>Rule 2:</strong> Select at least one <strong>Elective</strong> subject per semester.</li>
          <li><strong>Rule 3:</strong> Minor and Multidisciplinary courses are <strong>optional</strong>.</li>
        </ul>
      </div>

      <div className="page-header">
        <div>
          <h2 className="page-title">{semType} Semester Subjects</h2>
          <p className="page-subtitle">Expand each semester to view and select subjects. Submit your preferences for HOD review.</p>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 14 }} />)
      ) : semesterGroups.length === 0 ? (
        <div className="empty-state card card-body">
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <h3 className="empty-state-title">No Semesters Available</h3>
          <p className="empty-state-desc">No {semType?.toLowerCase()} semester subjects found for your department.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {semesterGroups.map(sg => {
            const isExpanded = expandedSem === sg.semester_number;
            const selected = selectedMap[sg.semester_number] || [];
            const isSubmitted = submittedPrefs[sg.semester_number];

            return (
              <div key={sg.semester_number} className="card" style={{ overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedSem(isExpanded ? null : sg.semester_number)}
                  style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: isExpanded ? '#F0F7FF' : 'white' }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: '14px', background: '#EFF6FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SEM</span>
                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#002147', lineHeight: 1 }}>{sg.semester_number}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>Semester {sg.semester_number} — {sg.programme_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {sg.subjects.length} subjects
                      {isSubmitted ? ' · ✅ Preferences Submitted' : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '20px', color: '#CBD5E1' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #E2E8F0', padding: '20px 22px' }} className="animate-slide-up">
                    {sg.subjects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        <p style={{ fontWeight: 600 }}>No subjects published for this semester yet.</p>
                      </div>
                    ) : (
                      <>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                              <th style={thStyle}>Select</th>
                              <th style={thStyle}>Subject</th>
                              <th style={thStyle}>Code</th>
                              <th style={thStyle}>Course Type</th>
                              <th style={thStyle}>Class Type</th>
                              <th style={thStyle}>T + P Hrs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sg.subjects.map(sub => {
                              const isSelected = selected.includes(sub.id);
                              const isOptional = sub.is_optional;
                              
                              // Determine if this subject should be disabled
                              const selectedSubs = sg.subjects.filter(s => selected.includes(s.id));
                              const hasCore = selectedSubs.some(s => s.category.toUpperCase() === 'CORE');
                              const hasElective = selectedSubs.some(s => ['ELECTIVE', 'DISCIPLINE_ELECTIVE'].includes(s.category.toUpperCase()));
                              const cat = sub.category.toUpperCase();
                              const isCoreSub = cat === 'CORE';
                              const isElectiveSub = cat === 'ELECTIVE' || cat === 'DISCIPLINE_ELECTIVE';
                              const isMinor = cat === 'MINOR' || cat === 'MULTIDISCIPLINARY';
                              
                              // Disable additional cores/electives after minimum is met, unless it's already selected
                              let disabled = false;
                              if (!isSelected && !isMinor) {
                                if (isCoreSub && hasCore) disabled = true;
                                if (isElectiveSub && hasElective) disabled = true;
                              }
                              if (isSubmitted) disabled = true;
                              if (sg.is_finalized) disabled = true;

                              return (
                                <tr key={sub.id} style={{ borderBottom: '1px solid #F1F5F9', opacity: disabled ? 0.5 : 1, background: isSelected ? '#EFF6FF' : 'white' }}>
                                  <td style={tdStyle}>
                                    <input type="checkbox" checked={isSelected} disabled={disabled}
                                      onChange={() => toggleSubject(sg.semester_number, sub.id)}
                                      style={{ width: 16, height: 16, accentColor: '#002147' }} />
                                  </td>
                                  <td style={{ ...tdStyle, fontWeight: 700, color: '#0F172A' }}>{sub.course_name}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748B' }}>{sub.course_code}</td>
                                  <td style={tdStyle}>
                                    <span style={{
                                      padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                      background: isCoreSub ? '#FEF3C7' : isElectiveSub ? '#DBEAFE' : '#F0FDF4',
                                      color: isCoreSub ? '#92400E' : isElectiveSub ? '#1E40AF' : '#166534',
                                    }}>
                                      {sub.category}{isOptional ? ' (Optional)' : ''}
                                    </span>
                                  </td>
                                  <td style={tdStyle}>
                                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '11px', fontWeight: 700 }}>
                                      {sub.class_type}
                                    </span>
                                  </td>
                                  <td style={tdStyle}>{sub.theory_hours}T + {sub.practical_hours}P</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {sg.is_finalized ? (
                          <div style={{ padding: '12px 16px', background: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA', fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>
                            🔒 This workspace has been finalized by the HOD. No further changes can be made.
                          </div>
                        ) : isSubmitted ? (
                          <div style={{ padding: '12px 16px', background: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', fontSize: '13px', color: '#065F46', fontWeight: 600 }}>
                            ✅ Preferences submitted. Please wait for HOD's approval.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                            <span style={{ fontSize: '13px', color: '#94A3B8', alignSelf: 'center' }}>
                              {selected.length} subject{selected.length !== 1 ? 's' : ''} selected
                            </span>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSubmit(sg)}
                              disabled={isSubmitting || selected.length === 0}
                            >
                              {isSubmitting ? 'Submitting...' : '📤 Submit Subject Preferences'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
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

const semCardStyle: React.CSSProperties = {
  padding: '32px 24px', borderRadius: '16px', border: '2px solid #E2E8F0',
  background: 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
  fontFamily: 'inherit',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700,
  color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px', color: '#475569', fontSize: '13px',
};
