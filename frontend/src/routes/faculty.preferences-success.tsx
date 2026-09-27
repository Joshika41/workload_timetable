import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/faculty/preferences-success')({
  component: FacultyPreferencesSuccessPage,
});

function FacultyPreferencesSuccessPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  return (
    <WorkloadShell
      role="faculty"
      title="Submission Successful"
    >
      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto mt-16 text-center bg-white p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="size-10" />
        </div>
        
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Preferences Submitted!</h2>
        <p className="text-slate-600 text-lg mb-8 max-w-md mx-auto">
          Your subject preferences have been successfully submitted and are now awaiting HOD review.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 w-full text-left mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Submission Details</h3>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-semibold text-slate-700">Date & Time</span>
            <span className="text-sm font-mono text-slate-900">{new Date().toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <span className="text-sm font-bold text-blue-700">Awaiting HOD Review</span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button 
            onClick={() => navigate({ to: '/faculty/dashboard' })}
            className="h-12 px-8 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300"
          >
            Back to Dashboard
          </Button>
          <Button 
            onClick={() => navigate({ to: '/faculty/preferences', search: { edit: true } })}
            className="h-12 px-8 bg-[#002147] hover:bg-[#001833] text-white font-bold"
          >
            Edit Preferences
          </Button>
        </div>
      </div>
    </WorkloadShell>
  );
}
