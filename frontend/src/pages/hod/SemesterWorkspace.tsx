import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/index';
import { toast } from 'sonner';
import PreferenceManagement from './PreferenceManagement';
import WorkloadAllocation from './WorkloadAllocation';
import ClassWiseMatrix from './ClassWiseMatrix';

export default function SemesterWorkspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [wsInfo, setWsInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setIsLoading(true);
    academicApi.getWorkspaceStatus(workspaceId)
      .then(setWsInfo)
      .catch(() => toast.error('Failed to load workspace info'))
      .finally(() => setIsLoading(false));
  }, [workspaceId]);

  if (!workspaceId) return null;

  const baseUrl = `/hod/workspace/${workspaceId}`;
  const ctx = session?.context;

  const TABS = [
    { to: baseUrl, label: 'Preference Management', icon: '📝', exact: true },
    { to: `${baseUrl}/allocation`, label: 'Workload Allocation', icon: '📊', exact: false },
    { to: `${baseUrl}/matrix`, label: 'Class-wise Matrix', icon: '📋', exact: false },
  ];

  return (
    <div className="animate-fade-in">
      {/* Back + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/hod')} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
          ← Back
        </button>
        <span style={{ color: '#CBD5E1' }}>|</span>
        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
          {ctx?.programmeName} · Semester {wsInfo ? decodeFromWorkspaceId(workspaceId) : '...'} · {ctx?.semesterType}
        </span>
        {wsInfo?.is_finalized && (
          <span className="chip chip-finalized" style={{ marginLeft: '4px' }}>✅ Finalized</span>
        )}
      </div>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: '24px' }}>
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.exact}
            className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Progress summary */}
      {!isLoading && wsInfo && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="stat-tile" style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <div>
              <div className="stat-tile-label">Allocated</div>
              <div className="stat-tile-value">{wsInfo.allocated_count}</div>
            </div>
            <div className="stat-tile-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>✓</div>
          </div>
          <div className="stat-tile" style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <div>
              <div className="stat-tile-label">Pending</div>
              <div className="stat-tile-value">{(wsInfo.pool_count || 0) - (wsInfo.allocated_count || 0)}</div>
            </div>
            <div className="stat-tile-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>⏳</div>
          </div>
          <div className="stat-tile" style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <div>
              <div className="stat-tile-label">Progress</div>
              <div className="stat-tile-value">{wsInfo.progress_percent}%</div>
            </div>
            <div className="stat-tile-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>📈</div>
          </div>
          <div className="stat-tile" style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <div>
              <div className="stat-tile-label">Status</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: wsInfo.is_finalized ? '#10B981' : '#F59E0B' }}>
                {wsInfo.workflow_state}
              </div>
            </div>
            <div className="stat-tile-icon" style={{ background: wsInfo.is_finalized ? '#ECFDF5' : '#FFFBEB' }}>
              {wsInfo.is_finalized ? '🔒' : '🔓'}
            </div>
          </div>
        </div>
      )}

      {/* Sub-routes */}
      <Routes>
        <Route path="/" element={<PreferenceManagement workspaceId={workspaceId} wsInfo={wsInfo} onRefresh={() => {
          academicApi.getWorkspaceStatus(workspaceId).then(setWsInfo).catch(() => {});
        }} />} />
        <Route path="/allocation" element={<WorkloadAllocation workspaceId={workspaceId} wsInfo={wsInfo} onRefresh={() => {
          academicApi.getWorkspaceStatus(workspaceId).then(setWsInfo).catch(() => {});
        }} />} />
        <Route path="/matrix" element={<ClassWiseMatrix workspaceId={workspaceId} />} />
      </Routes>
    </div>
  );
}

// Decode semester number from workspace_id (base64)
function decodeFromWorkspaceId(wsId: string): string {
  try {
    const json = JSON.parse(atob(wsId.replace(/-/g, '+').replace(/_/g, '/')));
    return String(json.s || '?');
  } catch {
    return '?';
  }
}
