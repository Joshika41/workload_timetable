import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { workloadApi } from '@/api/index';
import { toast } from 'sonner';

export default function WorkloadViewer() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'ODD' | 'EVEN'>('ODD');
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    workloadApi.getWorkloadViewer(activeTab)
      .then(setWorkloadData)
      .catch(() => toast.error('Failed to load workload data'))
      .finally(() => setIsLoading(false));
  }, [activeTab]);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Workload Viewer</h2>
          <p className="page-subtitle">Live view of current subject allocations.</p>
        </div>
        <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
          <button 
            onClick={() => setActiveTab('ODD')}
            style={{ 
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === 'ODD' ? 'white' : 'transparent', 
              color: activeTab === 'ODD' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'ODD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>
            View Odd Semester
          </button>
          <button 
            onClick={() => setActiveTab('EVEN')}
            style={{ 
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === 'EVEN' ? 'white' : 'transparent', 
              color: activeTab === 'EVEN' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'EVEN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>
            View Even Semester
          </button>
        </div>
      </div>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 10, borderRadius: 8 }} />)
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          {workloadData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div className="empty-state-icon">📋</div>
              <h3 className="empty-state-title">No allocations</h3>
              <p className="empty-state-desc">No allocations have been made yet.</p>
            </div>
          ) : (
            <table className="erp-table" style={{ whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Department</th>
                  <th>Programme</th>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Semester</th>
                  <th>Section</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Theory Hours</th>
                  <th style={{ textAlign: 'right' }}>Lab Hours</th>
                  <th style={{ textAlign: 'right' }}>Total Hours</th>
                  <th>Allocation Status</th>
                </tr>
              </thead>
              <tbody>
                {workloadData.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{row.faculty_name}</td>
                    <td>{row.department}</td>
                    <td>{row.programme}</td>
                    <td style={{ fontFamily: 'monospace', color: '#64748B' }}>{row.subject_code}</td>
                    <td style={{ fontWeight: 600 }}>{row.subject_name}</td>
                    <td>{row.semester}</td>
                    <td>{row.section}</td>
                    <td>{row.role}</td>
                    <td style={{ textAlign: 'right' }}>{row.theory_hours}</td>
                    <td style={{ textAlign: 'right' }}>{row.lab_hours}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{row.total_hours}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        background: '#EFF6FF', color: '#1D4ED8'
                      }}>
                        {row.allocation_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
