import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import MasterSubjectRepository from './MasterSubjectRepository';

export default function AdminShell() {
  const { session, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      navigate('/', { replace: true });
    } else if (session.role !== 'MASTER_ADMIN') {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  if (!session) return null;

  return (
    <div className="erp-layout">
      {/* Sidebar */}
      <aside className="erp-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/SRM%20LOGO.png" alt="SRM" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">SRM Master</div>
            <div className="sidebar-brand-sub">Super Admin Portal</div>
          </div>
        </div>

        {/* Context Info */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Authority
          </div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            {session.name}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#E8C96B', background: 'rgba(201,168,76,0.15)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(201,168,76,0.3)' }}>
              Universal Master Admin
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '6px' }}>
            Campus Wide Catalog & Policies
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Master Management</div>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📚</span>
            <span>Master Subjects</span>
          </NavLink>

          <NavLink
            to="/hod"
            className="sidebar-item"
          >
            <span style={{ fontSize: '16px', flexShrink: 0 }}>👤</span>
            <span>Switch to HOD View</span>
          </NavLink>

          <div className="sidebar-section-label" style={{ marginTop: '16px' }}>Account</div>
          <button className="sidebar-item" onClick={logOut} style={{ color: 'rgba(255,100,100,0.7)' }}>
            <span style={{ fontSize: '16px' }}>🚪</span>
            <span>Sign Out</span>
          </button>
        </nav>

        {/* User */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #E8C96B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#002147', flexShrink: 0 }}>
            A
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Universal Super Admin</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>admin@srmist.edu.in</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="erp-main">
        {/* Context Banner */}
        <div className="context-banner">
          <div className="context-banner-info">
            <span className="context-chip dept">🏛️ SRM University Campus</span>
            <span className="context-chip">🛡️ Super Administrator</span>
            <span className="context-chip">AY 2026-27</span>
          </div>
          <div className="context-banner-actions">
            <button className="btn-context-change" onClick={logOut}>Sign Out</button>
          </div>
        </div>

        {/* Routes */}
        <div className="erp-content">
          <Routes>
            <Route path="/" element={<MasterSubjectRepository />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
