import { useState, useEffect, useCallback } from 'react';
import { preferencesApi, allocationApi, academicApi } from '@/api/index';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import ProgressSphere from '@/components/ProgressSphere';

interface Faculty {
  id: number;
  name: string;
  erp_id: string;
  designation: string;
  cycle_state?: string;
  submission?: any;
}

interface AllocationFormData {
  subjectId: number;
  sectionId: number;
  role: string;
  theoryHours: number;
  practicalHours: number;
}

interface Props {
  workspaceId: string;
  wsInfo: any;
  onRefresh: () => void;
}

export default function PreferenceManagement({ workspaceId, wsInfo, onRefresh }: Props) {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedAllocForm, setExpandedAllocForm] = useState<number | null>(null);
  const [allocForms, setAllocForms] = useState<Record<number, AllocationFormData>>({});
  const [savingAlloc, setSavingAlloc] = useState<number | null>(null);
  const [noTeachingReason, setNoTeachingReason] = useState('');
  const [settingNoTeaching, setSettingNoTeaching] = useState<number | null>(null);
  const [isFinalizingWorkload, setIsFinalizingWorkload] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subsRes, prefsRes, subjectsRes] = await Promise.all([
        apiClient.get(`/faculty`, { params: { workspace_id: workspaceId } })
          .catch(() => ({ data: [] })),
        preferencesApi.getAllPreferences(workspaceId),
        academicApi.getSubjects(workspaceId).catch(() => []),
      ]);

      // Get sections from wsInfo
      const wsSections = wsInfo?.sections || [];
      setSections(wsSections);
      setSubjects(subjectsRes);

      // Build faculty list from subsRes
      const facultyMap: Record<number, Faculty> = {};
      const prefsData: any[] = prefsRes || [];
      const facultyData: any[] = subsRes?.data || [];
      
      setSubmissions(prefsData);

      // Add all faculty
      facultyData.forEach(fac => {
        facultyMap[fac.id] = {
          id: fac.id,
          name: fac.name,
          erp_id: fac.erp_id || 'N/A',
          designation: fac.designation || '',
          cycle_state: fac.cycle_state || 'PENDING'
        };
      });

      // Attach submissions to faculty
      prefsData.forEach((sub: any) => {
        if (facultyMap[sub.faculty_id]) {
          facultyMap[sub.faculty_id].submission = sub;
          if (sub.cycle_state) {
              facultyMap[sub.faculty_id].cycle_state = sub.cycle_state;
          }
        }
      });
      
      setFaculty(Object.values(facultyMap).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      toast.error('Failed to load preference data');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, wsInfo]);

  useEffect(() => { loadData(); }, [loadData]);

  const submittedFaculty = faculty.filter(f => f.submission?.status === 'SUBMITTED' || f.submission?.status === 'APPROVED');
  const pendingFaculty = faculty.filter(f => !f.submission || f.submission.status === 'DRAFT');
  const allocatedFaculty = faculty.filter(f => f.cycle_state === 'ALLOCATED');

  const displayFaculty = filter === 'submitted' ? submittedFaculty
    : filter === 'pending' ? pendingFaculty
    : faculty;

  const canFinalize = faculty.length > 0 && faculty.every(f =>
    f.cycle_state === 'ALLOCATED' || f.cycle_state === 'NO_TEACHING'
  );

  const handleAllocate = async (subjectId: number, subject: any) => {
    const formData = allocForms[subjectId];
    if (!formData) { toast.error('Please fill in the allocation details.'); return; }
    if (!formData.sectionId) { toast.error('Please select a section.'); return; }
    if (!formData.role) { toast.error('Please select a role.'); return; }
    if (!selectedFaculty) return;

    setSavingAlloc(subjectId);
    try {
      await allocationApi.create(workspaceId, formData.sectionId, subjectId, [
        {
          faculty_id: selectedFaculty.id,
          role: formData.role,
          theory_hours: formData.theoryHours,
          practical_hours: formData.practicalHours,
        }
      ]);
      // Mark faculty as ALLOCATED
      await allocationApi.setFacultyCycleState(selectedFaculty.id, workspaceId, 'ALLOCATED');
      toast.success(`Allocated ${subject.course_name} to ${selectedFaculty.name}`);
      setExpandedAllocForm(null);
      setAllocForms(prev => { const n = { ...prev }; delete n[subjectId]; return n; });
      await loadData();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save allocation');
    } finally {
      setSavingAlloc(null);
    }
  };

  const handleNoTeaching = async (fac: Faculty) => {
    setSettingNoTeaching(fac.id);
    try {
      await allocationApi.setFacultyCycleState(fac.id, workspaceId, 'NO_TEACHING', noTeachingReason || 'On leave');
      toast.success(`${fac.name} marked as No Teaching this semester`);
      setNoTeachingReason('');
      setSettingNoTeaching(null);
      await loadData();
      onRefresh();
    } catch {
      toast.error('Failed to update faculty state');
      setSettingNoTeaching(null);
    }
  };

  const handleFinalizeWorkload = async () => {
    if (!canFinalize) return;
    setIsFinalizingWorkload(true);
    try {
      await academicApi.finalizeWorkspace(workspaceId);
      toast.success('Workload finalized successfully! ✅');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to finalize workload');
    } finally {
      setIsFinalizingWorkload(false);
    }
  };

  // Get the submission for the selected faculty
  const selectedSubmission = selectedFaculty?.submission;
  const preferredSubjects = selectedSubmission?.items || [];

  const initAllocForm = (subjectId: number, subject: any) => {
    setAllocForms(prev => ({
      ...prev,
      [subjectId]: {
        subjectId,
        sectionId: sections[0]?.id || 0,
        role: 'MAIN',
        theoryHours: subject.theory_hours || 0,
        practicalHours: subject.practical_hours || 0,
      }
    }));
    setExpandedAllocForm(subjectId);
  };

  return (
    <div className="animate-fade-in">
      {/* Stats Header */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className="stat-tile clickable"
          style={{ flex: '1 1 160px', minWidth: 140, border: filter === 'submitted' ? '2px solid #10B981' : undefined }}
          onClick={() => setFilter(f => f === 'submitted' ? 'all' : 'submitted')}
        >
          <div>
            <div className="stat-tile-label">Submitted</div>
            <div className="stat-tile-value" style={{ color: '#10B981' }}>{submittedFaculty.length}</div>
          </div>
          <div className="stat-tile-icon" style={{ background: '#ECFDF5', color: '#10B981', fontSize: '20px' }}>✓</div>
        </button>
        <button
          className="stat-tile clickable"
          style={{ flex: '1 1 160px', minWidth: 140, border: filter === 'pending' ? '2px solid #F59E0B' : undefined }}
          onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')}
        >
          <div>
            <div className="stat-tile-label">Pending</div>
            <div className="stat-tile-value" style={{ color: '#F59E0B' }}>{pendingFaculty.length}</div>
          </div>
          <div className="stat-tile-icon" style={{ background: '#FFFBEB', color: '#F59E0B', fontSize: '20px' }}>⏳</div>
        </button>
        <div className="stat-tile" style={{ flex: '1 1 160px', minWidth: 140 }}>
          <div>
            <div className="stat-tile-label">Allocated</div>
            <div className="stat-tile-value" style={{ color: '#3B82F6' }}>{allocatedFaculty.length}</div>
          </div>
          <div className="stat-tile-icon" style={{ background: '#EFF6FF', color: '#3B82F6', fontSize: '20px' }}>📌</div>
        </div>
        <div className="stat-tile" style={{ flex: '1 1 100px', minWidth: 100 }}>
          <ProgressSphere percent={wsInfo?.progress_percent || 0} size={60} strokeWidth={5} />
        </div>
      </div>

      {/* Split Panel */}
      <div className="split-panel" style={{ height: 'auto', minHeight: '600px' }}>
        {/* LEFT: Faculty List */}
        <div className="split-panel-left">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Faculty ({displayFaculty.length})
            </div>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} style={{ fontSize: '11px', color: '#002147', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
                × Clear filter
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: '6px' }} />
                  <div className="skeleton skeleton-text" style={{ width: '40%', height: 12 }} />
                </div>
              ))
            ) : displayFaculty.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                <p style={{ fontSize: '13px', fontWeight: 600 }}>No faculty found</p>
              </div>
            ) : (
              displayFaculty.map(fac => {
                const state = fac.cycle_state;
                const chipClass = state === 'ALLOCATED' ? 'chip-allocated'
                  : state === 'NO_TEACHING' ? 'chip-no-teaching'
                  : fac.submission?.status === 'SUBMITTED' ? 'chip-submitted'
                  : 'chip-pending';

                return (
                  <div
                    key={fac.id}
                    className={`faculty-list-item ${selectedFaculty?.id === fac.id ? 'active' : ''}`}
                    onClick={() => setSelectedFaculty(fac)}
                  >
                    <div className="faculty-avatar">
                      {fac.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fac.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {fac.designation || 'Faculty'} · {fac.erp_id}
                      </div>
                      <span className={`chip ${chipClass}`} style={{ marginTop: '4px', display: 'inline-flex' }}>
                        {state === 'ALLOCATED' ? '✅ Allocated' : state === 'NO_TEACHING' ? '🔕 No Teaching' : fac.submission?.status === 'SUBMITTED' ? '📩 Submitted' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Faculty Detail */}
        <div className="split-panel-right">
          {!selectedFaculty ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <div className="empty-state-icon" style={{ fontSize: '32px' }}>👈</div>
              <h3 className="empty-state-title">Select a Faculty Member</h3>
              <p className="empty-state-desc">Click on any faculty in the left panel to review their preferences and allocate workload.</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Faculty Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div className="faculty-avatar" style={{ width: 48, height: 48, fontSize: '18px', flexShrink: 0 }}>
                    {selectedFaculty.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>{selectedFaculty.name}</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="chip chip-submitted">{selectedFaculty.designation || 'Faculty'}</span>
                      <span className="chip chip-not-started">{selectedFaculty.erp_id}</span>
                    </div>
                  </div>
                </div>
                {/* No Teaching button */}
                {selectedFaculty.cycle_state !== 'ALLOCATED' && selectedFaculty.cycle_state !== 'NO_TEACHING' && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      const reason = window.prompt(`Reason for ${selectedFaculty.name} having no teaching this semester?`, 'On leave');
                      if (reason !== null) {
                        setNoTeachingReason(reason);
                        handleNoTeaching(selectedFaculty);
                      }
                    }}
                    disabled={settingNoTeaching === selectedFaculty.id}
                  >
                    🔕 No Teaching
                  </button>
                )}
              </div>

              {/* Preferred Subjects */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    {preferredSubjects.length > 0 ? `Preferred Subjects (${preferredSubjects.length})` : 'No Preferences Submitted'}
                  </h4>
                  
                  {/* Approve/Deny buttons for the whole submission */}
                  {selectedSubmission && selectedSubmission.status === 'SUBMITTED' && selectedSubmission.review_status !== 'APPROVED' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={async () => {
                          try {
                            await preferencesApi.reviewSubmission(selectedSubmission.id, 'APPROVED');
                            toast.success('Submission approved');
                            await loadData();
                            onRefresh();
                          } catch (e) {
                            toast.error('Failed to approve submission');
                          }
                        }}
                      >
                        ✓ Approve Submission
                      </button>
                    </div>
                  )}
                </div>

                {preferredSubjects.length === 0 ? (
                  <div style={{ padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>This faculty has not submitted preferences yet.</p>
                    <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>You can still allocate subjects directly below.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {preferredSubjects.map((item: any) => {
                      const sub = item.subject || subjects.find(s => s.id === item.subject_id);
                      if (!sub) return null;
                      const isExpanded = expandedAllocForm === sub.id;
                      const formData = allocForms[sub.id];

                      return (
                        <div key={item.id} className={`pref-subject-item ${isExpanded ? 'allocating' : ''}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{sub.course_name}</span>
                                <span className={`chip ${sub.category === 'CORE' ? 'chip-core' : 'chip-elective'}`}>{sub.category}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                {sub.course_code} · Theory: {sub.theory_hours || 0}h · Practical: {sub.practical_hours || 0}h
                              </div>
                              <span className={`chip ${item.decision === 'APPROVED' ? 'chip-allocated' : item.decision === 'DENIED' ? 'chip-denied' : 'chip-pending'}`} style={{ marginTop: '6px', display: 'inline-flex' }}>
                                {item.decision || 'PENDING'}
                              </span>
                            </div>
                            <button
                              className={`btn ${isExpanded ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}`}
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedAllocForm(null);
                                } else {
                                  initAllocForm(sub.id, sub);
                                }
                              }}
                            >
                              {isExpanded ? '✕ Cancel' : '📌 Allocate'}
                            </button>
                          </div>

                          {/* Allocation Form */}
                          {isExpanded && formData && (
                            <div className="allocation-form">
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div className="form-group">
                                  <label className="form-label">Section</label>
                                  <select className="form-control"
                                    value={formData.sectionId}
                                    onChange={e => setAllocForms(p => ({ ...p, [sub.id]: { ...p[sub.id], sectionId: Number(e.target.value) } }))}>
                                    <option value="">Select section</option>
                                    {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Role</label>
                                  <select className="form-control"
                                    value={formData.role}
                                    onChange={e => setAllocForms(p => ({ ...p, [sub.id]: { ...p[sub.id], role: e.target.value } }))}>
                                    <option value="MAIN">Main In-charge</option>
                                    <option value="IN2">Assistant In-charge (IN-2)</option>
                                    <option value="ASSISTANT">Assistant</option>
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Theory Hours</label>
                                  <input type="number" className="form-control" min={0} max={20}
                                    value={formData.theoryHours}
                                    onChange={e => setAllocForms(p => ({ ...p, [sub.id]: { ...p[sub.id], theoryHours: Number(e.target.value) } }))} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Practical Hours</label>
                                  <input type="number" className="form-control" min={0} max={20}
                                    value={formData.practicalHours}
                                    onChange={e => setAllocForms(p => ({ ...p, [sub.id]: { ...p[sub.id], practicalHours: Number(e.target.value) } }))} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#64748B', alignSelf: 'center' }}>
                                  Total: {formData.theoryHours + formData.practicalHours}h
                                </span>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleAllocate(sub.id, sub)}
                                  disabled={savingAlloc === sub.id}
                                >
                                  {savingAlloc === sub.id ? 'Saving...' : '✓ Submit Allocation'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* HOD-Offered Subject (Add non-preferred) */}
              {subjects.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    ➕ Offer Additional Subject (HOD)
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="form-control" style={{ flex: 1 }}
                      onChange={e => {
                        const subId = Number(e.target.value);
                        if (subId) {
                          const sub = subjects.find(s => s.id === subId);
                          initAllocForm(subId, sub);
                        }
                      }}>
                      <option value="">— Select a subject to offer —</option>
                      {subjects.filter(s => !preferredSubjects.some((p: any) => p.subject_id === s.id)).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.course_name} ({s.course_code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Finalize Section */}
      <div className="finalize-section" style={{ marginTop: '20px' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Finalize Workload</h4>
          {!canFinalize ? (
            <p style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 600 }}>
              ⚠️ {faculty.filter(f => f.cycle_state !== 'ALLOCATED' && f.cycle_state !== 'NO_TEACHING').length} faculty still need allocation or "No Teaching" status before finalizing.
            </p>
          ) : (
            <p style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>✅ All faculty are allocated — ready to finalize!</p>
          )}
        </div>
        <button
          className="btn btn-gold btn-lg"
          disabled={!canFinalize || isFinalizingWorkload || wsInfo?.is_finalized}
          onClick={handleFinalizeWorkload}
        >
          {wsInfo?.is_finalized ? '🔒 Workload Finalized' : isFinalizingWorkload ? 'Finalizing...' : '🏁 Finalize Workload'}
        </button>
      </div>
    </div>
  );
}
