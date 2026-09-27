import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function NotFound() {
  const navigate = useNavigate();
  const { session } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', gap: '16px', textAlign: 'center', padding: '32px' }}>
      <div style={{ fontSize: '72px', fontWeight: 900, color: '#E2E8F0' }}>404</div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Page Not Found</h1>
      <p style={{ color: '#64748B', maxWidth: '380px', lineHeight: 1.6 }}>
        This page doesn't exist. You may have navigated to an invalid link.
      </p>
      <button
        className="btn btn-primary"
        onClick={() => {
          if (!session) navigate('/');
          else if (session.role === 'HOD') navigate('/hod');
          else navigate('/faculty');
        }}
      >
        Take Me Home
      </button>
    </div>
  );
}
