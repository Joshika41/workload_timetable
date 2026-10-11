import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { facultyApi, workloadApi } from '@/api/index';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import FacultyDetailModal from './FacultyDetail';
import ProgressSphere from '@/components/ProgressSphere';

interface FacultyRow {
  faculty_id: number;
  name: string;
  erp_id: string;
  designation: string;
  department: string;
  institution: string;
  preference_status: string;
  allocation_status: string;
}

const STATUS_CHIP: Record<string, { bg: string; color: string }> = {
  'Not Submitted': { bg: '#FEF2F2', color: '#DC2626' },
  'Submitted': { bg: '#FFF7ED', color: '#EA580C' },
  'Approved by HOD': { bg: '#F0FDF4', color: '#16A34A' },
  'Finalized': { bg: '#EFF6FF', color: '#2563EB' },
  'Not Allocated': { bg: '#F8FAFC', color: '#64748B' },
  'Allocated': { bg: '#F0FDF4', color: '#16A34A' },
};

export default function HODHome() {
  const { session, updateContext } = useAuth();
  const ctx = session?.context;
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<any>(null);

  const fetchDashboardData = async () => {
    setError(null);
    try {
      const [facResult, statsResult] = await Promise.allSettled([
        facultyApi.getHODFacultyList(session?.context?.semesterType),
        workloadApi.getDashboardStats(session?.context?.semesterType)
      ]);
      
      if (facResult.status === 'fulfilled') {
        setFaculty(facResult.value);
      } else {
        toast.error('Failed to load faculty list');
        setError('Failed to load faculty list. Please try again.');
      }
      
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        console.error("Dashboard stats failed:", statsResult.reason);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchDashboardData();
  }, [session?.context?.semesterType]);

  const handleFinalize = async () => {
    if (!window.confirm("Are you sure you want to finalize the workload for the department? This will lock all current allocations.")) return;
    setIsFinalizing(true);
    try {
      const res = await apiClient.post('/workload/finalize/department');
      toast.success(res.data?.message || 'Workload finalized.');
      // Refresh faculty list and stats
      const [facData, statsData] = await Promise.all([
        facultyApi.getHODFacultyList(session?.context?.semesterType),
        workloadApi.getDashboardStats(session?.context?.semesterType)
      ]);
      setFaculty(facData);
      setStats(statsData);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to finalize workload.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleReopen = async () => {
    if (!window.confirm("Are you sure you want to reopen finalized workloads? This will allow modifications to allocations.")) return;
    setIsReopening(true);
    try {
      const res = await apiClient.post('/workload/reopen/department');
      toast.success(res.data?.message || 'Workload reopened.');
      // Refresh faculty list and stats
      const [facData, statsData] = await Promise.all([
        facultyApi.getHODFacultyList(ctx?.semesterType),
        workloadApi.getDashboardStats(session?.context?.semesterType)
      ]);
      setFaculty(facData);
      setStats(statsData);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to reopen workload.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const resp = await apiClient.get('/workload/export.pdf', { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `department_workload.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to export PDF. Ensure workload is finalized.');
    }
  };

  if (!session || !ctx) return null;
  const allSubmitted = faculty.length > 0 && faculty.every(f => f.preference_status !== 'Not Submitted');

  return (
    <div className="animate-fade-in">
      {/* Welcome Banner */}
      <div className="welcome-banner" style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          HOD Dashboard
        </p>
        <h1 className="welcome-title" style={{ marginBottom: '6px' }}>
          Welcome, {session.name}!
        </h1>
        <p className="welcome-subtitle" style={{ lineHeight: '1.5' }}>
          {ctx.departmentName} · {ctx.institutionName} · AY {ctx.academicYear}<br/>
          {stats?.programmes?.length ? `Programmes: ${stats.programmes.join(', ')}` : ''}
        </p>
        <div className="welcome-meta">
          <span className="welcome-chip">🏛️ {ctx.institutionName}</span>
          <span className="welcome-chip">📋 {ctx.departmentName}</span>
          <span className="welcome-chip">👤 {ctx.designation}</span>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Faculty</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '8px' }}>{stats.faculty_count}</div>
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Allocation Progress</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '8px' }}>{stats.allocation_progress}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{stats.faculty_with_teaching} allocated / {stats.faculty_no_teaching} unallocated</div>
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Submitted ({ctx.semesterType})</div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>
                {stats[`${ctx.semesterType.toLowerCase()}_stats`]?.submitted} <span style={{fontSize: '16px', color: '#64748B'}}>/ {stats.faculty_count}</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Not Submitted ({ctx.semesterType})</div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>
                {stats[`${ctx.semesterType.toLowerCase()}_stats`]?.not_submitted} <span style={{fontSize: '16px', color: '#64748B'}}>/ {stats.faculty_count}</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Completion</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                {stats.faculty_with_teaching} out of {stats.faculty_count} allocated
              </div>
            </div>
            <ProgressSphere percent={stats.faculty_count > 0 ? Math.round((stats.faculty_with_teaching / stats.faculty_count) * 100) : 0} size={64} strokeWidth={6} />
          </div>
        </div>
      )}

      {/* Semester Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => updateContext({ semesterType: 'ODD' })}
          style={{
            flex: 1, padding: '24px', borderRadius: '16px', border: 'none',
            background: ctx.semesterType === 'ODD' ? 'linear-gradient(135deg, #002147, #003366)' : 'white',
            color: ctx.semesterType === 'ODD' ? 'white' : '#64748B',
            boxShadow: ctx.semesterType === 'ODD' ? '0 10px 25px -5px rgba(0,33,71,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer', transition: 'all 0.3s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
          }}
        >
          <div style={{ fontSize: '32px' }}>📅</div>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>ODD Semester</div>
        </button>
        <button
          onClick={() => updateContext({ semesterType: 'EVEN' })}
          style={{
            flex: 1, padding: '24px', borderRadius: '16px', border: 'none',
            background: ctx.semesterType === 'EVEN' ? 'linear-gradient(135deg, #002147, #003366)' : 'white',
            color: ctx.semesterType === 'EVEN' ? 'white' : '#64748B',
            boxShadow: ctx.semesterType === 'EVEN' ? '0 10px 25px -5px rgba(0,33,71,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer', transition: 'all 0.3s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
          }}
        >
          <div style={{ fontSize: '32px' }}>📆</div>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>EVEN Semester</div>
        </button>
      </div>

      {/* Workload Actions Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Department Workload Actions</h3>
          <p style={{ fontSize: '13px', color: '#64748B' }}>Finalize workloads when all faculty allocations are complete, or export the current snapshot as a PDF.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleFinalize} 
            disabled={isFinalizing || !allSubmitted}
            title={!allSubmitted ? "All faculty must submit preferences before finalizing" : ""}
            style={!allSubmitted ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {isFinalizing ? 'Finalizing...' : '🔒 Finalize Workload'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleReopen} 
            disabled={isReopening}
            style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}
          >
            {isReopening ? 'Reopening...' : '🔓 Reopen Workload'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF} 
          >
            📄 Export Workload as PDF
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Faculty Members</h2>
          <p className="page-subtitle">Review faculty preferences and manage workload allocations. Faculty are ordered by seniority.</p>
        </div>
        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
          {isLoading ? (
            <div className="skeleton" style={{ width: '120px', height: '20px', display: 'inline-block', borderRadius: '4px' }} />
          ) : (
            `${faculty.length} faculty member${faculty.length !== 1 ? 's' : ''}`
          )}
        </span>
      </div>

      {/* Faculty Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: '10px' }} />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state card card-body" style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
          <div className="empty-state-icon">⚠️</div>
          <h3 className="empty-state-title" style={{ color: '#DC2626' }}>Error Loading Data</h3>
          <p className="empty-state-desc" style={{ color: '#991B1B' }}>{error}</p>
        </div>
      ) : faculty.length === 0 ? (
        <div className="empty-state card card-body">
          <div className="empty-state-icon">👥</div>
          <h3 className="empty-state-title">No Faculty Found</h3>
          <p className="empty-state-desc">
            No faculty members are currently assigned to your department.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Faculty Name</th>
                <th style={thStyle}>Employee ID</th>
                <th style={thStyle}>Designation</th>
                <th style={thStyle}>Department</th>
                <th style={thStyle}>Preference Status</th>
                <th style={thStyle}>Allocation Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map((f, idx) => (
                <tr key={f.faculty_id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFE')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#0F172A' }}>{f.name}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#475569' }}>{f.erp_id}</td>
                  <td style={tdStyle}>{f.designation}</td>
                  <td style={tdStyle}>{f.department}</td>
                  <td style={tdStyle}>
                    <StatusChip status={f.preference_status} />
                  </td>
                  <td style={tdStyle}>
                    <StatusChip status={f.allocation_status} />
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setSelectedFacultyId(f.faculty_id)}
                      style={{
                        padding: '6px 16px', borderRadius: '8px', border: '1px solid #002147',
                        background: '#002147', color: 'white', fontWeight: 600, fontSize: '12px',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#003580'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#002147'; }}
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {selectedFacultyId && (
        <FacultyDetailModal 
          facultyId={selectedFacultyId} 
          onClose={() => setSelectedFacultyId(null)}
          onAllocationSaved={fetchDashboardData}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const style = STATUS_CHIP[status] || { bg: '#F8FAFC', color: '#64748B' };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 700,
      background: style.bg, color: style.color,
    }}>
      {status}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
  color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
  padding: '14px', color: '#475569', fontSize: '13px',
};
