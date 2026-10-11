import React, { useState, useEffect } from 'react';
import { timetableApi } from '@/api/timetable';
import { toast } from 'sonner';

export default function HODTimetable({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  const [entries, setEntries] = useState<any[]>([]);
  const [timetableMeta, setTimetableMeta] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>(undefined);
  
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const loadVersions = async () => {
    try {
      const data = await timetableApi.getVersions(workspaceId);
      setVersions(data);
    } catch (e) {
      toast.error('Failed to load version history');
    }
  };

  const loadTimetable = async (versionId?: number) => {
    setLoading(true);
    try {
      const data = await timetableApi.getTimetable(workspaceId, versionId);
      setEntries(data.entries || []);
      setTimetableMeta(data);
      if (data.version_id) {
        setSelectedVersionId(data.version_id);
      }
    } catch (e) {
      toast.error('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
    loadTimetable(selectedVersionId);
  }, [workspaceId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setDiagnostics(null);
    try {
      const data = await timetableApi.generateTimetable(workspaceId);
      setDiagnostics(data);
      if (data.status === 'FAILED') {
        toast.error('Timetable generation failed due to hard constraints');
      } else {
        toast.success(`Timetable generated successfully (${data.status})`);
        await loadVersions();
        if (data.version_id) {
            await loadTimetable(data.version_id);
        } else {
            await loadTimetable();
        }
      }
    } catch (e) {
      toast.error('Failed to generate timetable');
    } finally {
      setGenerating(false);
    }
  };
  
  const handlePublish = async () => {
      if (!selectedVersionId) return;
      setPublishing(true);
      try {
          await timetableApi.publishVersion(selectedVersionId);
          toast.success("Timetable published successfully!");
          await loadVersions();
          await loadTimetable(selectedVersionId);
      } catch (e) {
          toast.error("Failed to publish timetable");
      } finally {
          setPublishing(false);
      }
  };
  
  const handleVersionSelect = (vid: number) => {
      setSelectedVersionId(vid);
      loadTimetable(vid);
  };

  const DAYS = ["Mo", "Tu", "We", "Th", "Fr"];
  const PERIODS = [
    { num: 1, label: 'P1\n08:00' },
    { num: 2, label: 'P2\n08:45' },
    { num: 3, label: 'P3\n09:30' },
    { num: -1, label: 'BREAK\n10:15' },
    { num: 4, label: 'P4\n10:30' },
    { num: 5, label: 'P5\n11:15' },
    { num: 6, label: 'P6\n12:00' },
  ];

  const sectionGrids: Record<string, Record<string, Record<number, any>>> = {};
  
  entries.forEach(entry => {
      const pnum = entry.period_number;
      const d = DAYS[entry.day_index] || DAYS[0];
      const secs = entry.sections && entry.sections.length > 0 ? entry.sections : ["General"];
      secs.forEach((sec: string) => {
          if (!sectionGrids[sec]) sectionGrids[sec] = {};
          if (!sectionGrids[sec][d]) sectionGrids[sec][d] = {};
          sectionGrids[sec][d][pnum] = entry;
      });
  });

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div className="section-card" style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 className="text-xl font-semibold text-white">Class Timetable</h2>
            <p className="text-sm text-slate-400">View and manage the timetable context.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleGenerate} 
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate New Version'}
              </button>
              
              {timetableMeta && timetableMeta.status === 'DRAFT' && (
                  <button 
                    className="btn btn-success" 
                    onClick={handlePublish} 
                    disabled={publishing || generating}
                    style={{ background: '#10b981', color: '#fff', border: 'none' }}
                  >
                    {publishing ? 'Publishing...' : 'Publish Version'}
                  </button>
              )}
          </div>
        </div>

        {diagnostics && (
          <div style={{ marginBottom: '20px', padding: '15px', background: diagnostics.status === 'FAILED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${diagnostics.status === 'FAILED' ? '#ef4444' : '#10b981'}`, borderRadius: '8px' }}>
            <h3 style={{ color: diagnostics.status === 'FAILED' ? '#ef4444' : '#10b981', fontWeight: 600, marginBottom: '10px' }}>
              Generation Status: {diagnostics.status}
            </h3>
            {diagnostics.violations && diagnostics.violations.length > 0 && (
              <ul style={{ color: '#ef4444', fontSize: '13px', marginLeft: '20px', listStyleType: 'disc' }}>
                {diagnostics.violations.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        
        {timetableMeta && timetableMeta.status === 'PUBLISHED' && (
            <div style={{ marginBottom: '20px', padding: '10px 15px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></span>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>PUBLISHED TIMETABLE</span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto' }}>Version ID: {timetableMeta.version_id} | Created: {new Date(timetableMeta.created_at).toLocaleString()}</span>
            </div>
        )}
        
        {timetableMeta && timetableMeta.status === 'DRAFT' && (
            <div style={{ marginBottom: '20px', padding: '10px 15px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>DRAFT TIMETABLE (Unpublished)</span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto' }}>Version ID: {timetableMeta.version_id} | Created: {new Date(timetableMeta.created_at).toLocaleString()}</span>
            </div>
        )}
        
        {timetableMeta && timetableMeta.status === 'SUPERSEDED' && (
            <div style={{ marginBottom: '20px', padding: '10px 15px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid #64748b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#64748b' }}></span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>ARCHIVED TIMETABLE (Superseded)</span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto' }}>Version ID: {timetableMeta.version_id}</span>
            </div>
        )}

        {loading ? (
          <div className="text-slate-400">Loading timetable...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No timetable generated or selected yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {Object.keys(sectionGrids).sort().map(section => (
              <div key={section} className="timetable-wrapper">
                <h3 className="text-lg font-bold text-white mb-4">Class: {section}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="erp-table" style={{ minWidth: '800px', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>Day</th>
                        {PERIODS.map(p => (
                          <th key={p.num} style={{ textAlign: 'center', whiteSpace: 'pre-wrap', fontSize: '11px', color: p.num === -1 ? '#f59e0b' : '#94a3b8' }}>
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td style={{ fontWeight: 600, color: 'white', textAlign: 'center' }}>{day}</td>
                          {PERIODS.map(p => {
                            if (p.num === -1) {
                              return (
                                <td key="break" style={{ background: 'rgba(245, 158, 11, 0.05)', textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: '#f59e0b', writingMode: 'vertical-lr', margin: 'auto', fontWeight: 600, letterSpacing: '2px' }}>
                                    BREAK
                                  </div>
                                </td>
                              );
                            }
                            
                            const entry = sectionGrids[section]?.[day]?.[p.num];
                            
                            if (!entry) {
                              return <td key={p.num} style={{ border: '1px solid rgba(255,255,255,0.05)' }}></td>;
                            }
                            
                            return (
                              <td key={p.num} style={{ padding: '4px', border: '1px solid rgba(255,255,255,0.1)', verticalAlign: 'top', background: 'rgba(255,255,255,0.03)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%', justifyContent: 'center' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', textAlign: 'center' }}>{entry.subject_code}</div>
                                  <div style={{ fontSize: '10px', color: '#cbd5e1', textAlign: 'center' }}>{entry.faculty}</div>
                                  <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>{entry.room} ({entry.teaching_type})</div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="section-card" style={{ width: '300px', height: 'fit-content' }}>
          <h3 className="text-lg font-bold text-white mb-4">Version History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {versions.length === 0 ? (
                  <div className="text-sm text-slate-400">No versions found.</div>
              ) : (
                  versions.map(v => (
                      <div 
                        key={v.id} 
                        onClick={() => handleVersionSelect(v.id)}
                        style={{ 
                            padding: '12px', 
                            borderRadius: '8px', 
                            border: `1px solid ${selectedVersionId === v.id ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`, 
                            background: selectedVersionId === v.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            cursor: 'pointer'
                        }}
                      >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <span style={{ fontWeight: 600, color: 'white' }}>Version {v.id}</span>
                              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '10px', 
                                background: v.status === 'PUBLISHED' ? '#3b82f6' : (v.status === 'DRAFT' ? '#f59e0b' : '#64748b'),
                                color: 'white'
                              }}>{v.status}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              <div>Generated: {new Date(v.created_at).toLocaleDateString()}</div>
                              <div style={{ color: v.violations > 0 ? '#ef4444' : '#10b981' }}>Violations: {v.violations}</div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
}
