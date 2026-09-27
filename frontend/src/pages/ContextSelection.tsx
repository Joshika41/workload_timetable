import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { academicApi, authApi } from '@/api/index';
import { toast } from 'sonner';

export default function ContextSelection() {
  const { session, isLoading: authLoading, realLogin } = useAuth();
  const navigate = useNavigate();

  const [institutions, setInstitutions] = useState<{id: number, name: string}[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoadingInst, setIsLoadingInst] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedRole, setSelectedRole] = useState<'HOD' | 'FACULTY'>('HOD');
  const [selectedInstId, setSelectedInstId] = useState<number | ''>('');
  const [selectedProfileId, setSelectedProfileId] = useState<number | ''>('');

  useEffect(() => {
    if (!authLoading && session) {
      if (session.role === 'HOD' || session.role === 'ERP_COORDINATOR') navigate('/hod');
      else navigate('/faculty');
    }
  }, [session, authLoading, navigate]);

  useEffect(() => {
    academicApi.getInstitutions()
      .then(data => { setInstitutions(data); setIsLoadingInst(false); })
      .catch(() => { toast.error('Failed to load institutions.'); setIsLoadingInst(false); });
  }, []);

  useEffect(() => {
    if (selectedInstId && selectedRole) {
      authApi.getProfiles(selectedRole, Number(selectedInstId))
        .then(setProfiles)
        .catch(() => setProfiles([]));
    } else {
      setProfiles([]);
    }
    setSelectedProfileId('');
  }, [selectedRole, selectedInstId]);

  const activeProfile = profiles.find(p => p.user_id === selectedProfileId);

  const handleLogin = async () => {
    if (!activeProfile) return;
    setIsSubmitting(true);
    try {
      await realLogin(activeProfile.username, '123456');
    } catch {
      // Error handled in auth.tsx
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#001530]">
      <div style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #001530 0%, #002147 50%, #003580 100%)',
        minHeight: '100vh',
      }}
    >
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(201,168,76,0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,71,171,0.15) 0%, transparent 50%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '920px', minHeight: '640px',
        display: 'flex', gap: 0, background: 'white',
        borderRadius: '24px', overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)',
      }}>

        {/* LEFT PANEL — Branding */}
        <div style={{
          width: '360px', flexShrink: 0,
          background: 'linear-gradient(160deg, #002147 0%, #003580 60%, #001a36 100%)',
          padding: '48px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          color: 'white', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(201,168,76,0.06)', top: -100, right: -80 }} />
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: -60, left: -40 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 72, height: 72, background: 'white', borderRadius: '16px',
              padding: '8px', marginBottom: '24px', overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              <img src="/srm-logo.jpeg" alt="SRM Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'white', marginBottom: '8px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SRM Ramapuram
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '32px' }}>
              Faculty of Science and Humanities<br />
              Workload & Timetable Portal
            </p>

            <div style={{
              background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
              borderRadius: '12px', padding: '16px 18px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#E8C96B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Phase 1 — Workload
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                Subject preferences, workload allocation, and class-wise matrix generation.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Login UI */}
        <div style={{ flex: 1, padding: '48px 40px', overflowY: 'auto' }}>
          
          {/* Role Toggle */}
          <div style={{ display: 'flex', background: '#F8FAFC', borderRadius: '12px', padding: '4px', marginBottom: '32px' }}>
            <button onClick={() => setSelectedRole('HOD')}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px',
                background: selectedRole === 'HOD' ? '#002147' : 'transparent',
                color: selectedRole === 'HOD' ? 'white' : '#64748B',
                fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
              <span>👤</span> HOD
            </button>
            <button onClick={() => setSelectedRole('FACULTY')}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px',
                background: selectedRole === 'FACULTY' ? '#002147' : 'transparent',
                color: selectedRole === 'FACULTY' ? 'white' : '#64748B',
                fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
              <span>👨‍🏫</span> Faculty
            </button>
          </div>

          {/* Institution Selector */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
              Select Group / School
            </label>
            {isLoadingInst ? (
              <div className="skeleton skeleton-text" style={{ height: 46 }} />
            ) : (
              <select
                className="form-control"
                value={selectedInstId}
                onChange={e => setSelectedInstId(e.target.value ? Number(e.target.value) : '')}
                style={{ height: '48px', fontSize: '15px', fontWeight: 600, color: '#0F172A', border: '2px solid #E2E8F0', borderRadius: '10px' }}
              >
                <option value="">— Select Institution —</option>
                {institutions.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Profile Selector */}
          {selectedInstId !== '' && (
            <div style={{ marginBottom: '32px' }} className="animate-slide-up">
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
                Choose Your Profile *
              </label>
              <select
                className="form-control"
                value={selectedProfileId}
                onChange={e => setSelectedProfileId(e.target.value ? Number(e.target.value) : '')}
                style={{ height: '48px', fontSize: '15px', fontWeight: 700, color: '#002147', border: '2px solid #002147', borderRadius: '10px', background: '#F8FAFC' }}
              >
                <option value="">— Select Profile —</option>
                {profiles.map(p => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.name} — {p.department} ({p.erp_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Profile Card */}
          {activeProfile && (
            <div className="animate-slide-up" style={{ 
              marginBottom: '32px', padding: '20px', borderRadius: '16px', 
              background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#002147', letterSpacing: '1px' }}>ACTIVE PROFILE</span>
                <span style={{ fontSize: '10px', fontWeight: 800, background: '#002147', color: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                  {selectedRole}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>FULL NAME</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{activeProfile.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>EMPLOYEE ID</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#002147' }}>{activeProfile.erp_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>DESIGNATION</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{activeProfile.designation}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>DEPARTMENT</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{activeProfile.department}</div>
                </div>
              </div>
            </div>
          )}

          {/* Credentials */}
          {activeProfile && (
            <div className="animate-slide-up">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
                  EMPLOYEE ID / USERNAME
                </label>
                <input type="text" className="form-control" value={activeProfile.username} readOnly disabled 
                  style={{ background: '#F8FAFC', color: '#64748B', fontWeight: 600, border: 'none' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
                  PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="password" className="form-control" value="123456" readOnly disabled
                    style={{ background: '#F8FAFC', color: '#0F172A', fontWeight: 800, border: '1px solid #E2E8F0', letterSpacing: '4px' }} />
                  <span style={{ position: 'absolute', right: '16px', top: '14px', color: '#94A3B8' }}>👁️</span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', height: '52px', fontSize: '15px', fontWeight: 700 }}
                disabled={isSubmitting}
                onClick={handleLogin}
              >
                {isSubmitting ? 'Signing in...' : `Sign In as ${activeProfile.name}`}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
