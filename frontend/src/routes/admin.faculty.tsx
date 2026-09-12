import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import { adminNav } from '@/components/portal-nav';
import { useQuery } from '@tanstack/react-query';
import { Key } from 'lucide-react';

export const Route = createFileRoute('/admin/faculty')({
  component: UserAccessPanel,
});

function UserAccessPanel() {
  const { session } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('FACULTY');
  const [facultyId, setFacultyId] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: facultyList } = useQuery({
    queryKey: ['admin-faculty-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/admin/faculty-list');
        return res.data;
      } catch (e) {
        return [];
      }
    }
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !role) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const payload: any = { email, password, role };
      if (role === 'FACULTY' && facultyId) {
        payload.faculty_id = parseInt(facultyId);
      }
      
      await api.post('/api/auth/create-user', payload);
      toast.success(role + ' User created successfully!');
      setEmail('');
      setPassword('');
      setFacultyId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalShell
      role='admin'
      title='User Access Panel'
      subtitle='Manage passwords and system access for Faculty and Deans'
      nav={adminNav || []}
    >
      <div className='w-full max-w-xl mx-auto rounded-xl border border-border bg-card p-6 shadow-sm'>
        <div className='flex items-center gap-3 mb-6 border-b pb-4'>
          <div className='p-2 bg-primary/10 rounded-lg text-primary'>
            <Key className='w-6 h-6' />
          </div>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>Generate Credentials</h2>
            <p className='text-sm text-muted-foreground'>Create secure logins mapped to ERP records.</p>
          </div>
        </div>
        
        <form onSubmit={handleCreateUser} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-1'>Role</label>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className='w-full rounded border border-border bg-background px-3 py-2 text-sm'
            >
              <option value='FACULTY'>Faculty</option>
              <option value='DEAN'>Dean</option>
              </select>
          </div>
          
          <div>
            <label className='block text-sm font-medium mb-1'>Email Address</label>
            <input 
              type='email' 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='faculty@srm.edu'
              className='w-full rounded border border-border bg-background px-3 py-2 text-sm'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-1'>Temporary Password</label>
            <input 
              type='password' 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder='********'
              className='w-full rounded border border-border bg-background px-3 py-2 text-sm'
              required
            />
          </div>

          {role === 'FACULTY' && (
            <div>
              <label className='block text-sm font-medium mb-1'>Link to Faculty Record</label>
              <select 
                value={facultyId} 
                onChange={e => setFacultyId(e.target.value)}
                className='w-full rounded border border-border bg-background px-3 py-2 text-sm'
              >
                <option value=''>-- Select Faculty to bind --</option>
                {facultyList && facultyList.map((f: any) => (
                  <option key={f.id || f.faculty_id} value={f.id || f.faculty_id}>
                    {f.name} ({f.department})
                  </option>
                ))}
              </select>
              <p className='text-xs text-muted-foreground mt-1'>
                Crucial: Binds the login ID to the Faculty profile so preferences work correctly.
              </p>
            </div>
          )}

          <Button type='submit' disabled={loading} className='w-full mt-4'>
            {loading ? 'Generating...' : 'Create User Access'}
          </Button>
        </form>
      </div>
    </PortalShell>
  );
}

