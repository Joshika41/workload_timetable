import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { facultyNav } from '@/components/portal-nav';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

export const Route = createFileRoute('/faculty/')({
  component: FacultyPreferences,
});

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

function FacultyPreferences() {
  const { session } = useAuth();
  const [preferences, setPreferences] = useState<{ day: string, period: number, type: 'PREFER' | 'AVOID' | null }[]>([]);

  const handleSlotClick = (day: string, period: number) => {
    setPreferences(prev => {
      const existing = prev.find(p => p.day === day && p.period === period);
      if (!existing || existing.type === null) {
        return [...prev.filter(p => p.day !== day || p.period !== period), { day, period, type: 'PREFER' }];
      } else if (existing.type === 'PREFER') {
        return [...prev.filter(p => p.day !== day || p.period !== period), { day, period, type: 'AVOID' }];
      } else {
        return prev.filter(p => p.day !== day || p.period !== period);
      }
    });
  };

  const submitPreferences = async () => {
    try {
      const payload = preferences.filter(p => p.type !== null).map(p => ({
        preferred_day: p.day,
        preferred_period: p.period,
        preference_type: p.type
      }));
      
      // Post each preference
      await Promise.all(payload.map(p => api.post('/api/faculty/preferences', p)));
      
      toast.success('Time slot preferences submitted successfully!');
    } catch (err: any) {
      toast.error('Failed to submit preferences');
    }
  };

  const getSlotColor = (day: string, period: number) => {
    const pref = preferences.find(p => p.day === day && p.period === period);
    if (pref?.type === 'PREFER') return 'bg-emerald-500/20 border-emerald-500 text-emerald-700';
    if (pref?.type === 'AVOID') return 'bg-destructive/20 border-destructive text-destructive';
    return 'bg-background hover:bg-muted border-border';
  };

  return (
    <PortalShell
      role='faculty'
      title='Time Slot Preferences'
      subtitle={`Welcome, ${session?.name ?? 'Faculty'} - Set your preferred and restricted teaching hours`}
      nav={facultyNav}
    >
      <div className='rounded-xl border border-border bg-card p-6 shadow-sm max-w-4xl'>
        <h2 className='text-lg font-semibold text-foreground mb-4'>Availability Grid</h2>
        <p className='text-sm text-muted-foreground mb-6'>
          Click slots to toggle between <span className='font-bold text-emerald-600'>PREFER</span>, <span className='font-bold text-destructive'>AVOID</span>, and Neutral.
        </p>

        <div className='overflow-x-auto mb-6'>
          <table className='w-full border-collapse'>
            <thead>
              <tr>
                <th className='p-2 border font-medium text-sm text-muted-foreground bg-muted'>Day</th>
                {PERIODS.map(p => (
                  <th key={p} className='p-2 border font-medium text-sm text-muted-foreground bg-muted'>Period {p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td className='p-2 border font-medium text-sm bg-muted/30'>{day}</td>
                  {PERIODS.map(period => (
                    <td key={period} className='p-1 border text-center'>
                      <button
                        onClick={() => handleSlotClick(day, period)}
                        className={`w-full py-3 rounded text-xs font-semibold border transition-colors ${getSlotColor(day, period)}`}
                      >
                        {preferences.find(p => p.day === day && p.period === period)?.type || '-'}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={submitPreferences} className='w-full'>
          Submit Time Slot Preferences
        </Button>
      </div>
    </PortalShell>
  );
}
