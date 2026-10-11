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

  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  useEffect(() => {
    if (selectedInstId && selectedRole) {
      setIsLoadingProfiles(true);
      authApi.getProfiles(selectedRole, Number(selectedInstId))
        .then(setProfiles)
        .catch((e: any) => {
          console.error("Failed to load profiles:", e);
          toast.error(e.response?.data?.detail || e.message || 'Failed to load profiles.');
          setProfiles([]);
        })
        .finally(() => setIsLoadingProfiles(false));
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
      await realLogin(activeProfile.username, '123456', selectedRole);
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
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '1080px', minHeight: '640px',
        display: 'flex', gap: 0, background: 'white',
        borderRadius: '24px', overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)',
      }}>

        {/* LEFT PANEL — Branding */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(160deg, #002147 0%, #003580 60%, #001a36 100%)',
          padding: '64px 48px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          color: 'white', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: -150, right: -150 }} />
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', bottom: -100, left: -50 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 300,
              marginBottom: '40px',
            }}>
              <img src="/SRM%20LOGO.png" alt="SRM Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em', marginBottom: '16px', lineHeight: 1.4 }}>
              SRM INSTITUTE OF SCIENCE AND TECHNOLOGY, RAMAPURAM CAMPUS
            </h2>
            <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
              WORKLOAD AND TIMETABLE PORTAL
            </h1>
          </div>
        </div>

        {/* RIGHT PANEL — Login UI */}
        <div style={{ flex: 1, padding: '48px 64px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Portal Sign In</h2>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Select your login role and choose your profile to proceed</p>
          </div>

          {/* Role Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
              Select Login Role
            </label>
            <div style={{ display: 'flex', background: '#F8FAFC', borderRadius: '12px', padding: '4px', border: '1px solid #E2E8F0' }}>
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
                disabled={isLoadingProfiles}
              >
                <option value="">{isLoadingProfiles ? '— Loading Profiles... —' : '— Select Profile —'}</option>
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
