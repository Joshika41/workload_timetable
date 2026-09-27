import { useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import FacultyHome from './FacultyHome';
import MySubjects from './MySubjects';

export default function FacultyShell() {
  const { session, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) navigate('/', { replace: true });
    else if (session.role !== 'FACULTY') navigate('/', { replace: true });
  }, [session, navigate]);

  if (!session) return null;
  const { context } = session;

  return (
    <div className="erp-layout">
      {/* Sidebar */}
      <aside className="erp-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/srm-logo.jpeg" alt="SRM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">SRM Workload</div>
            <div className="sidebar-brand-sub">Faculty Portal</div>
          </div>
        </div>

        {/* Context Info */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Your Context
          </div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
            {session.name}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
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

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          <NavLink to="/faculty" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span style={{ fontSize: '16px' }}>📝</span>
            <span>Subject Preferences</span>
          </NavLink>
          <NavLink to="/faculty/my-subjects" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span style={{ fontSize: '16px' }}>📚</span>
            <span>My Subjects</span>
          </NavLink>

          <div className="sidebar-section-label" style={{ marginTop: '16px' }}>Account</div>
          <button className="sidebar-item" onClick={logOut} style={{ color: 'rgba(255,100,100,0.7)' }}>
            <span style={{ fontSize: '16px' }}>🚪</span>
            <span>Sign Out</span>
          </button>
        </nav>

        {/* User */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Faculty · {context.departmentName}</div>
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

        <div className="erp-content">
          <Routes>
            <Route path="/" element={<FacultyHome />} />
            <Route path="/my-subjects" element={<MySubjects />} />
            <Route path="*" element={<Navigate to="/faculty" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
