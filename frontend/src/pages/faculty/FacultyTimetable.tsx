import React, { useState, useEffect } from 'react';
import { timetableApi } from '@/api/timetable';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export default function FacultyTimetable({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const loadTimetable = async () => {
      setLoading(true);
      try {
        const data = await timetableApi.getTimetable(workspaceId);
        // Filter out only this faculty's entries
        const myEntries = (data.entries || []).filter((e: any) => e.user_id === user?.id);
        setEntries(myEntries);
      } catch (e) {
        toast.error('Failed to load timetable');
      } finally {
        setLoading(false);
      }
    };
    loadTimetable();
  }, [workspaceId, user?.id]);

  const DAYS = ["Mo", "Tu", "We", "Th", "Fr"];
  const PERIODS = [
    { num: 1, label: 'P1\n08:00' },
    { num: 2, label: 'P2\n08:45' },
    { num: 3, label: 'P3\n09:30' },
    { num: -1, label: 'BREAK\n10:15' },
    { num: 4, label: 'P4\n10:30' },
    { num: 5, label: 'P5\n11:15' },
    { num: 6, label: 'P6\n12:00' },
  ];

  const grid: Record<string, Record<number, any>> = {};
  
  entries.forEach(entry => {
      const pnum = entry.period_number;
      const d = DAYS[entry.day_index] || DAYS[0];
      if (!grid[d]) grid[d] = {};
      grid[d][pnum] = entry;
  });

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">My Timetable</h2>
      <p className="text-sm font-semibold text-slate-500 mb-6">Your weekly teaching schedule for this semester.</p>

      {loading ? (
        <div className="text-slate-400">Loading timetable...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No timetable available. The HOD might not have generated it yet.</div>
      ) : (
        <div className="timetable-wrapper" style={{ marginTop: '20px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table" style={{ minWidth: '800px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px', background: '#002147', color: 'white' }}>Day</th>
                  {PERIODS.map(p => (
                    <th key={p.num} style={{ textAlign: 'center', whiteSpace: 'pre-wrap', fontSize: '11px', color: p.num === -1 ? '#f59e0b' : 'inherit', background: '#002147' }}>
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td style={{ fontWeight: 600, color: '#334155', textAlign: 'center', background: '#f8fafc' }}>{day}</td>
                    {PERIODS.map(p => {
                      if (p.num === -1) {
                        return (
                          <td key="break" style={{ background: 'rgba(245, 158, 11, 0.05)', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#f59e0b', writingMode: 'vertical-lr', margin: 'auto', fontWeight: 600, letterSpacing: '2px' }}>
                              BREAK
                            </div>
                          </td>
                        );
                      }
                      
                      const entry = grid[day]?.[p.num];
                      
                      if (!entry) {
                        return <td key={p.num} style={{ border: '1px solid #e2e8f0' }}></td>;
                      }
                      
                      return (
                        <td key={p.num} style={{ padding: '4px', border: '1px solid #e2e8f0', verticalAlign: 'top', background: '#f0fdfa' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%', justifyContent: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', textAlign: 'center' }}>{entry.subject_code}</div>
                            <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>{entry.sections.join(', ')}</div>
                            <div style={{ fontSize: '10px', color: '#334155', textAlign: 'center', fontWeight: 600 }}>{entry.room}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
