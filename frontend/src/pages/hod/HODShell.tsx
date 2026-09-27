import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import HODHome from './HODHome';
import SemesterWorkspace from './SemesterWorkspace';
import WorkloadViewer from './WorkloadViewer';
import HODSettings from './HODSettings';
import FacultyDetail from './FacultyDetail';

const NAV_ITEMS = [
  { to: '/hod', label: 'Faculty List', icon: '👥', exact: true },
  { to: '/hod/viewer', label: 'Workload Viewer', icon: '👁️', exact: false },
  { to: '/hod/settings', label: 'Settings', icon: '⚙️', exact: false },
];

export default function HODShell() {
  const { session, logOut, updateContext } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) navigate('/', { replace: true });
    else if (session.role !== 'HOD' && session.role !== 'ERP_COORDINATOR') navigate('/', { replace: true });
  }, [session, navigate]);

  if (!session) return null;
  const { context } = session;

  return (
    <div className="erp-layout">
      {/* Sidebar */}
      <aside className="erp-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/srm-logo.jpeg" alt="SRM" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">SRM Workload</div>
            <div className="sidebar-brand-sub">HOD Portal</div>
          </div>
        </div>

        {/* Context Info */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Your Context
          </div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            {session.name}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#E8C96B', background: 'rgba(201,168,76,0.15)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(201,168,76,0.3)' }}>
              {context.institutionName}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '20px' }}>
              {context.designation}
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '6px' }}>
            {context.departmentName}
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: '16px' }}>Account</div>
          <button className="sidebar-item" onClick={logOut} style={{ color: 'rgba(255,100,100,0.7)' }}>
            <span style={{ fontSize: '16px' }}>🚪</span>
            <span>Sign Out</span>
          </button>
        </nav>

        {/* User */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #E8C96B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#002147', flexShrink: 0 }}>
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>HOD · {context.departmentName}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="erp-main">
        {/* Context Banner */}
        <div className="context-banner">
          <div className="context-banner-info">
            <span className="context-chip dept">🏛️ {context.institutionName}</span>
            <span className="context-chip">📋 {context.departmentName}</span>
            <span className="context-chip">👤 {context.designation}</span>
            <span className="context-chip">AY {context.academicYear}</span>

          </div>
          <div className="context-banner-actions">
            <button className="btn-context-change" onClick={logOut}>Sign Out</button>
          </div>
        </div>

        {/* Routes */}
        <div className="erp-content">
          <Routes>
            <Route path="/" element={<HODHome />} />
            <Route path="/faculty/:facultyId" element={<FacultyDetail />} />
            <Route path="/viewer" element={<WorkloadViewer />} />
            <Route path="/settings" element={<HODSettings />} />
            <Route path="/workspace/:workspaceId/*" element={<SemesterWorkspace />} />
            <Route path="*" element={<Navigate to="/hod" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

