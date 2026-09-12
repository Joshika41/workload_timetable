import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { deanNav } from '@/components/portal-nav';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';

export const Route = createFileRoute('/dean/')({
  component: DeanDashboard,
});

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

function DeanDashboard() {
  const { session } = useAuth();
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  const { data: masterTimetable, isLoading } = useQuery({
    queryKey: ['master-timetable'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/workload/summary');
        return res.data;
      } catch (e) {
        return [];
      }
    }
  });

  const getSlot = (day: string, period: number) => {
    if (!masterTimetable) return [];
    return masterTimetable.filter((t: any) => 
      t.day === day && 
      t.period === period && 
      (departmentFilter === 'ALL' || t.department === departmentFilter)
    );
  };

  const departments = masterTimetable ? Array.from(new Set(masterTimetable.map((t: any) => t.department))) : [];

  return (
    <PortalShell
      role='dean'
      title='Master Timetable Oversight'
      subtitle='Universal layout mapping all assignments across departments'
      nav={deanNav}
    >
      <div className='rounded-xl border border-border bg-card p-6 shadow-sm'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-lg font-semibold text-foreground'>Institutional Matrix</h2>
          
          <div className='flex gap-4'>
            <Button
              variant='outline'
              onClick={async () => {
                try {
                  const response = await api.get('/api/export/timetable', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'master_timetable.xlsx');
                  document.body.appendChild(link);
                  link.click();
                  link.parentNode?.removeChild(link);
                } catch (err) {
                  toast.error('Export failed');
                }
              }}
              className='bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 border-green-500/20'
            >
              <FileSpreadsheet className='mr-2 size-4' />
              Export to Excel
            </Button>
            
            <select 
              value={departmentFilter}  
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className='rounded border border-border bg-background px-3 py-2 text-sm'
            >
              <option value='ALL'>All Departments</option>
              {departments.map((d: any) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className='overflow-x-auto mb-6'>
          {isLoading ? (
            <p className='text-muted-foreground text-center py-8'>Loading Master Timetable...</p>
          ) : (
            <table className='w-full border-collapse'>
              <thead>
                <tr>
                  <th className='p-3 border font-medium text-sm text-muted-foreground bg-muted w-32'>Day</th>
                  {PERIODS.map(p => (
                    <th key={p} className='p-3 border font-medium text-sm text-muted-foreground bg-muted'>Period {p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className='p-3 border font-medium text-sm bg-muted/30'>{day}</td>
                    {PERIODS.map(period => {
                      const slots = getSlot(day, period);
                      return (
                        <td key={period} className='p-2 border text-xs align-top'>
                          {slots.length === 0 ? (
                            <span className='text-muted-foreground/50 italic'>Empty</span>
                          ) : (
                            <div className='space-y-2 max-h-32 overflow-y-auto pr-1'>
                              {slots.map((s: any, idx: number) => (
                                <div key={idx} className='p-1.5 rounded bg-primary/10 border border-primary/20 text-primary-foreground'>
                                  <div className='font-semibold text-primary truncate'>{s.subject_name}</div>
                                  <div className='text-muted-foreground truncate'>{s.faculty_name}</div>
                                  <div className='flex justify-between mt-1 text-[10px] text-muted-foreground'>
                                    <span>{s.room_no}</span>
                                    <span>{s.section}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
