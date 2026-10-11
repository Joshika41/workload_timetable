import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface SemesterGroup {
  semester_number: number;
  programme_name: string;
  programme_id: number;
  subjects: SubjectRow[];
  requires_preference?: boolean;
  has_core_available?: boolean;
  has_elective_available?: boolean;
  is_submitted?: boolean;
  status?: string;
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
  requires_preference?: boolean;
}

type SemType = 'ODD' | 'EVEN';

interface WarningModalState {
  isOpen: boolean;
  title: string;
  message: string;
  incompleteSemesters: string[];
}

export default function FacultyHome() {
  const { session } = useAuth();
  const [semType, setSemType] = useState<SemType | null>(null);
  const [semesterGroups, setSemesterGroups] = useState<SemesterGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSem, setExpandedSem] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, number[]>>({});
  const [isDraftSaving, setIsDraftSaving] = useState<Record<string, boolean>>({});
  const [isTermSubmitting, setIsTermSubmitting] = useState(false);
  const [oddStatus, setOddStatus] = useState<{ submitted: boolean; count: number; semList: string[] }>({ submitted: false, count: 0, semList: [] });
  const [evenStatus, setEvenStatus] = useState<{ submitted: boolean; count: number; semList: string[] }>({ submitted: false, count: 0, semList: [] });
  const [progFilter, setProgFilter] = useState<string>('All');
  const [editingMap, setEditingMap] = useState<Record<string, boolean>>({});
  const [warningModal, setWarningModal] = useState<WarningModalState>({
    isOpen: false,
    title: '',
    message: '',
    incompleteSemesters: []
  });

  const ctx = session?.context;
  const uniqueProgrammes = Array.from(new Set(semesterGroups.map(sg => sg.programme_name))).sort();
  const filteredGroups = progFilter === 'All' ? semesterGroups : semesterGroups.filter(sg => sg.programme_name === progFilter);

  const loadOverview = async () => {
    try {
      const [oddRes, evenRes] = await Promise.all([
        apiClient.get<SemesterGroup[]>('/faculty/my-semesters', { params: { semester_type: 'ODD', programme_type: ctx?.programmeType || undefined } }),
        apiClient.get<SemesterGroup[]>('/faculty/my-semesters', { params: { semester_type: 'EVEN', programme_type: ctx?.programmeType || undefined } }),
      ]);
      
      // A semester type is fully submitted only when ALL applicable semester groups (requiring preference) are submitted
      const oddApplicable = oddRes.data.filter(g => g.requires_preference !== false);
      const oddSubmitted = oddApplicable.filter(g => g.is_submitted || g.status === 'SUBMITTED' || g.status === 'APPROVED');
      const isOddFullySubmitted = oddApplicable.length > 0 && oddSubmitted.length === oddApplicable.length;

      const evenApplicable = evenRes.data.filter(g => g.requires_preference !== false);
      const evenSubmitted = evenApplicable.filter(g => g.is_submitted || g.status === 'SUBMITTED' || g.status === 'APPROVED');
      const isEvenFullySubmitted = evenApplicable.length > 0 && evenSubmitted.length === evenApplicable.length;

      setOddStatus({
        submitted: isOddFullySubmitted,
        count: oddSubmitted.length,
        semList: oddApplicable.map(g => `Sem ${g.semester_number}`),
      });
      setEvenStatus({
        submitted: isEvenFullySubmitted,
        count: evenSubmitted.length,
        semList: evenApplicable.map(g => `Sem ${g.semester_number}`),
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (ctx) {
      loadOverview();
    }
  }, [ctx]);

  useEffect(() => {
    if (semType && ctx) {
      loadSemesters(semType);
    }
  }, [semType]);

  const loadSemesters = async (st: SemType) => {
    setIsLoading(true);
    try {
      const resp = await apiClient.get<SemesterGroup[]>(`/faculty/my-semesters`, { params: { semester_type: st, programme_type: ctx?.programmeType || undefined } });
      const groups = resp.data;
      setSemesterGroups(groups);
      
      const newSelectedMap: Record<string, number[]> = {};
      
      groups.forEach(g => {
        const key = `${g.semester_number}_${g.programme_id}`;
        if (g.selected_subject_ids) {
          newSelectedMap[key] = g.selected_subject_ids;
        }
      });
      
      setSelectedMap(newSelectedMap);
    } catch (err: any) {
      toast.error(`Failed to load semesters: ${err?.response?.data?.detail || err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSubject = (semGroup: SemesterGroup, subId: number) => {
    const key = `${semGroup.semester_number}_${semGroup.programme_id}`;
    const current = selectedMap[key] || [];
    if (current.includes(subId)) {
      setSelectedMap(p => ({ ...p, [key]: current.filter(id => id !== subId) }));
    } else {
      setSelectedMap(p => ({ ...p, [key]: [...current, subId] }));
    }
  };

  // ── Save single semester draft
  const handleSaveDraft = async (semGroup: SemesterGroup) => {
    const key = `${semGroup.semester_number}_${semGroup.programme_id}`;
    const selected = selectedMap[key] || [];
    
    setIsDraftSaving(prev => ({ ...prev, [key]: true }));
    try {
      await apiClient.post('/faculty/preferences/save-draft', {
        semester_number: semGroup.semester_number,
        programme_id: semGroup.programme_id,
        semester_type: semType,
        subject_ids: selected,
      });
      toast.success(`Draft saved for Semester ${semGroup.semester_number} (${semGroup.programme_name}).`);
      setSemesterGroups(prev => prev.map(g => {
        if (g.semester_number === semGroup.semester_number && g.programme_id === semGroup.programme_id) {
          return { ...g, status: 'DRAFT', selected_subject_ids: selected };
        }
        return g;
      }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || 'Failed to save draft preferences.');
    } finally {
      setIsDraftSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Submit whole semester type (ODD or EVEN)
  const handleSubmitTerm = async () => {
    if (!semType) return;

    // Client-side completeness check before making API call
    const applicableGroups = semesterGroups.filter(g => g.requires_preference !== false);
    const incompleteContexts: string[] = [];

    applicableGroups.forEach(sg => {
      const key = `${sg.semester_number}_${sg.programme_id}`;
      const selected = selectedMap[key] || [];
      const label = `Semester ${sg.semester_number} (${sg.programme_name})`;

      if (selected.length === 0) {
        incompleteContexts.push(label);
        return;
      }

      // Check category requirements
      const selectedSubs = sg.subjects.filter(s => selected.includes(s.id));
      const hasCore = selectedSubs.some(s => s.category.toUpperCase() === 'CORE');
      const hasElective = selectedSubs.some(s => ['ELECTIVE', 'DISCIPLINE_ELECTIVE'].includes(s.category.toUpperCase()));

      if (sg.has_core_available && sg.has_elective_available) {
        if (!hasCore || !hasElective) {
          incompleteContexts.push(`${label} (Must select at least 1 Core & 1 Elective)`);
        }
      } else if (sg.has_core_available && !sg.has_elective_available) {
        if (!hasCore) {
          incompleteContexts.push(`${label} (Must select at least 1 Core)`);
        }
      } else if (!sg.has_core_available && sg.has_elective_available) {
        if (!hasElective) {
          incompleteContexts.push(`${label} (Must select at least 1 Elective)`);
        }
      }
    });

    if (incompleteContexts.length > 0) {
      setWarningModal({
        isOpen: true,
        title: `Incomplete ${semType} Preferences`,
        message: `Please finish your preference submission for all applicable semesters in this ${semType} semester.`,
        incompleteSemesters: incompleteContexts,
      });
      return;
    }

    // Build payload
    const selectionsPayload = applicableGroups.map(sg => {
      const key = `${sg.semester_number}_${sg.programme_id}`;
      return {
        semester_number: sg.semester_number,
        programme_id: sg.programme_id,
        subject_ids: selectedMap[key] || [],
      };
    });

    setIsTermSubmitting(true);
    try {
      await apiClient.post('/faculty/preferences/submit-term', {
        semester_type: semType,
        selections: selectionsPayload,
      });

      toast.success(`All ${semType} preferences submitted successfully! ✅`);
      setEditingMap({});
      if (semType) await loadSemesters(semType);
      await loadOverview();
    } catch (err: any) {
      const respData = err?.response?.data;
      const detail = respData?.detail;
      if (typeof detail === 'object' && detail?.incomplete_semesters) {
        setWarningModal({
          isOpen: true,
          title: `Incomplete ${semType} Preferences`,
          message: detail.message || `Please finish your preference submission for all applicable semesters in this ${semType} semester.`,
          incompleteSemesters: detail.incomplete_semesters,
        });
      } else {
        const errorMsg = typeof detail === 'string' ? detail : 'Failed to submit preferences.';
        toast.error(errorMsg);
      }
    } finally {
      setIsTermSubmitting(false);
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
        <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📝</span> Your Submission Status
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>AY {ctx.academicYear}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '10px', background: oddStatus.submitted ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${oddStatus.submitted ? '#BBF7D0' : '#E2E8F0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>ODD Term</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: oddStatus.submitted ? '#DCFCE7' : '#F1F5F9', color: oddStatus.submitted ? '#166534' : '#64748B' }}>
                  {oddStatus.submitted ? 'Submitted' : 'Pending'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: oddStatus.submitted ? '#15803D' : '#64748B', margin: 0 }}>
                {oddStatus.submitted ? `Preferences submitted for ${oddStatus.semList.join(', ')}.` : 'Not submitted yet. Select ODD Semester below to choose subjects.'}
              </p>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '10px', background: evenStatus.submitted ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${evenStatus.submitted ? '#BBF7D0' : '#E2E8F0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>EVEN Term</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: evenStatus.submitted ? '#DCFCE7' : '#F1F5F9', color: evenStatus.submitted ? '#166534' : '#64748B' }}>
                  {evenStatus.submitted ? 'Submitted' : 'Pending'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: evenStatus.submitted ? '#15803D' : '#64748B', margin: 0 }}>
                {evenStatus.submitted ? `Preferences submitted for ${evenStatus.semList.join(', ')}.` : 'Not submitted yet. Select EVEN Semester below to choose subjects.'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '600px' }}>
          <button onClick={() => setSemType('ODD')} style={{ ...semCardStyle, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: oddStatus.submitted ? '#DCFCE7' : '#F1F5F9', color: oddStatus.submitted ? '#166534' : '#64748B' }}>
                {oddStatus.submitted ? '✓ Submitted' : 'Pending'}
              </span>
            </div>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📚</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147', marginBottom: '6px' }}>ODD Semester</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Odd terms</div>
          </button>
          <button onClick={() => setSemType('EVEN')} style={{ ...semCardStyle, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: evenStatus.submitted ? '#DCFCE7' : '#F1F5F9', color: evenStatus.submitted ? '#166534' : '#64748B' }}>
                {evenStatus.submitted ? '✓ Submitted' : 'Pending'}
              </span>
            </div>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📖</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147', marginBottom: '6px' }}>EVEN Semester</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Even terms</div>
          </button>
        </div>
      </div>
    );
  }

  // Calculate term-level status
  const applicableGroups = semesterGroups.filter(g => g.requires_preference !== false);
  const allApplicableSubmitted = applicableGroups.length > 0 && applicableGroups.every(g => g.is_submitted || g.status === 'SUBMITTED' || g.status === 'APPROVED');

  return (
    <div className="animate-fade-in">
      {/* Warning Popup Modal for Incomplete Submission */}
      {warningModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', maxWidth: '520px', width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            <div style={{ background: '#FEF2F2', padding: '20px 24px', borderBottom: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#991B1B' }}>
                  {warningModal.title}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#B91C1C' }}>
                  Action required before final submission
                </p>
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#1E293B', fontWeight: 600, lineHeight: 1.5, marginBottom: '16px' }}>
                "{warningModal.message}"
              </p>
              {warningModal.incompleteSemesters.length > 0 && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px 16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Remaining Incomplete Semesters:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#DC2626', fontWeight: 600, lineHeight: 1.6 }}>
                    {warningModal.incompleteSemesters.map((semName, i) => (
                      <li key={i}>{semName}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                💡 Your existing draft selections are safely preserved. Please make selections for all listed semesters and submit again.
              </p>
            </div>
            <div style={{ background: '#F8FAFC', padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}
                style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '8px', fontWeight: 700 }}
              >
                Got It, Complete My Preferences
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Back button & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={() => { setSemType(null); setSemesterGroups([]); setExpandedSem(null); loadOverview(); }}
          style={{ background: 'none', border: 'none', color: '#002147', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← Back to Semester Type
        </button>

        {/* Global Submit Action for this Semester Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {allApplicableSubmitted && Object.keys(editingMap).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DCFCE7', color: '#166534', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: '1px solid #BBF7D0' }}>
              <span>✅ All {semType} Preferences Submitted for HOD Review</span>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmitTerm}
              disabled={isTermSubmitting || applicableGroups.length === 0}
              style={{
                background: '#002147', color: '#FFD700', fontWeight: 800, padding: '10px 20px',
                borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 6px -1px rgba(0, 33, 71, 0.2)'
              }}
            >
              {isTermSubmitting ? 'Validating & Submitting...' : `📤 Submit All ${semType} Preferences`}
            </button>
          )}
        </div>
      </div>

      {/* Rules Panel */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', marginBottom: '8px' }}>📋 Selection Rules</h4>
        <ul style={{ fontSize: '12px', color: '#78350F', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
          <li><strong>Rule 1 (Completeness):</strong> All applicable semesters in this {semType} semester must be completed before overall submission is accepted.</li>
          <li><strong>Rule 2 (Flexible Categories):</strong> For semesters offering both Core and Electives, select at least 1 Core and 1 Elective. For semesters offering only Core or only Electives, select from the available subjects.</li>
          <li><strong>Rule 3 (Project Work / Non-timetabled):</strong> Semesters dedicated solely to project work or non-timetabled subjects do not require faculty preference submission; HOD allocates faculty directly.</li>
          <li><strong>Rule 4 (Drafts vs. Submit):</strong> Use "Save Draft" on each semester while deciding. Click "Submit All {semType} Preferences" when ready.</li>
        </ul>
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">{semType} Semester Subjects</h2>
          <p className="page-subtitle">Expand each semester to view and select subjects. Save drafts or submit the entire {semType} semester.</p>
        </div>
        <div style={{ minWidth: '220px' }}>
          <select 
            className="form-control"
            value={progFilter}
            onChange={(e) => setProgFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', cursor: 'pointer' }}
          >
            <option value="All">All Programmes</option>
            {uniqueProgrammes.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 14 }} />)
      ) : filteredGroups.length === 0 ? (
        <div className="empty-state card card-body">
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <h3 className="empty-state-title">No Semesters Available</h3>
          <p className="empty-state-desc">No {semType?.toLowerCase()} semester subjects found for your department.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredGroups.map(sg => {
            const sgKey = `${sg.semester_number}_${sg.programme_id}`;
            const isExpanded = expandedSem === sgKey;
            const selected = selectedMap[sgKey] || [];
            const isSubmitted = sg.is_submitted || sg.status === 'SUBMITTED' || sg.status === 'APPROVED';
            const isDraft = sg.status === 'DRAFT' && !isSubmitted;
            const isProjectOnly = sg.requires_preference === false;
            const isSaving = isDraftSaving[sgKey];

            return (
              <div key={sgKey} className="card" style={{ overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedSem(isExpanded ? null : sgKey)}
                  style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: isExpanded ? '#F0F7FF' : 'white' }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: '14px', background: isProjectOnly ? '#F1F5F9' : '#EFF6FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SEM</span>
                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#002147', lineHeight: 1 }}>{sg.semester_number}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Semester {sg.semester_number} — {sg.programme_name}
                      {isProjectOnly && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#92400E' }}>
                          Project / Non-timetabled
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {sg.subjects.length} subjects
                      {isProjectOnly ? ' · Exempt from faculty preference selection (HOD allocation only)' :
                       isSubmitted ? ' · ✅ Preferences Submitted' :
                       isDraft ? ' · 📝 Draft Saved' : ' · ⏳ Pending Selection'}
                    </div>
                  </div>
                  <span style={{ fontSize: '20px', color: '#CBD5E1' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #E2E8F0', padding: '20px 22px' }} className="animate-slide-up">
                    {isProjectOnly ? (
                      <div style={{ padding: '20px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎓</div>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                          Non-Timetabled / Project Work Semester
                        </h4>
                        <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '540px', margin: '0 auto 12px' }}>
                          This semester contains project work or non-timetabled offerings. Normal subject-preference selection is not required and will not block your {semType} submission. HOD allocates faculty directly.
                        </p>
                        <div style={{ display: 'inline-block', padding: '6px 12px', background: '#DCFCE7', borderRadius: '6px', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
                          ✓ Ready for Semester-Type Submission
                        </div>
                      </div>
                    ) : sg.subjects.length === 0 ? (
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
                              
                              // Determine disable state based on category availability
                              const selectedSubs = sg.subjects.filter(s => selected.includes(s.id));
                              const hasCore = selectedSubs.some(s => s.category.toUpperCase() === 'CORE');
                              const hasElective = selectedSubs.some(s => ['ELECTIVE', 'DISCIPLINE_ELECTIVE'].includes(s.category.toUpperCase()));
                              const cat = sub.category.toUpperCase();
                              const isCoreSub = cat === 'CORE';
                              const isElectiveSub = cat === 'ELECTIVE' || cat === 'DISCIPLINE_ELECTIVE';
                              const isMinor = cat === 'MINOR' || cat === 'MULTIDISCIPLINARY';
                              
                              // Disable logic:
                              // Only disable additional cores if BOTH Core and Electives are available and a core is already chosen.
                              // If only cores are available in the semester, faculty can pick freely without artificial lock.
                              let disabled = false;
                              if (!isSelected && !isMinor) {
                                if (sg.has_core_available && sg.has_elective_available) {
                                  if (isCoreSub && hasCore) disabled = true;
                                  if (isElectiveSub && hasElective) disabled = true;
                                }
                              }
                              const isEditing = editingMap[sgKey] || false;
                              if (isSubmitted && !isEditing) disabled = true;
                              if (sg.is_finalized) disabled = true;

                              return (
                                <tr key={sub.id} style={{ borderBottom: '1px solid #F1F5F9', opacity: disabled && !isSelected ? 0.5 : 1, background: isSelected ? '#EFF6FF' : 'white' }}>
                                  <td style={tdStyle}>
                                    <input type="checkbox" checked={isSelected} disabled={disabled}
                                      onChange={() => toggleSubject(sg, sub.id)}
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
                        ) : (
                          <>
                            {isSubmitted && !editingMap[sgKey] && (
                              <div style={{ padding: '12px 16px', background: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', fontSize: '13px', color: '#065F46', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>✅ Preferences submitted as part of {semType} submission.</span>
                                <button 
                                  className="btn" 
                                  onClick={() => setEditingMap(prev => ({...prev, [sgKey]: true}))}
                                  style={{ background: 'white', border: '1px solid #059669', color: '#059669', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  ✏️ Edit Selections
                                </button>
                              </div>
                            )}
                            {(!isSubmitted || editingMap[sgKey]) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                                <div>
                                  {isDraft && (
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', background: '#FEF3C7', padding: '4px 10px', borderRadius: '6px' }}>
                                      Draft Saved
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  {editingMap[sgKey] && (
                                    <button 
                                      className="btn"
                                      onClick={() => {
                                        setEditingMap(prev => ({...prev, [sgKey]: false}));
                                        if (semType) loadSemesters(semType);
                                      }}
                                      style={{ background: 'white', border: '1px solid #CBD5E1', color: '#64748B', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                                    {selected.length} subject{selected.length !== 1 ? 's' : ''} selected
                                  </span>
                                  <button
                                    className="btn btn-outline"
                                    onClick={() => handleSaveDraft(sg)}
                                    disabled={isSaving || selected.length === 0}
                                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', fontWeight: 600 }}
                                  >
                                    {isSaving ? 'Saving Draft...' : '💾 Save Draft'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
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

