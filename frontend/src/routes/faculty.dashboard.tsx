import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ClipboardList, BookOpen, Clock, User, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { preferenceApi } from '@/api/preferenceApi';

export const Route = createFileRoute('/faculty/dashboard')({
  component: FacultyHomePage,
});

function FacultyHomePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [prefStatus, setPrefStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      preferenceApi.getFacultyPreferences(activeWorkspace.workspace_id)
        .then(res => {
          if (res && res.length > 0) {
            setPrefStatus(res[0].status);
          } else {
            setPrefStatus('NOT_SUBMITTED');
          }
        })
        .catch(console.error);
    }
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  return (
    <WorkloadShell
      role="faculty"
      title={session?.user?.name || "Faculty Portal"}
      subtitle={`${activeWorkspace.department_name} · ${activeWorkspace.programme_name} · Semester ${activeWorkspace.semester} · ${activeWorkspace.academic_year_name}`}
    >
      <div className="max-w-5xl mx-auto space-y-6 pt-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* MY PREFERENCES */}
          <button 
            onClick={() => navigate({ to: '/faculty/preferences' })}
            className="group flex flex-col items-start p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <div className="size-12 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ClipboardList className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center justify-between w-full">
              My Subject Preferences
              <ChevronRight className="size-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </h3>
            <p className="text-sm text-slate-500">
              Choose and rank subjects you are willing to teach for the current semester.
            </p>
            {prefStatus && (
              <div className="mt-4 pt-4 border-t border-slate-100 w-full flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  prefStatus === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                  prefStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {prefStatus.replace('_', ' ')}
                </span>
              </div>
            )}
          </button>

          {/* MY SUBJECTS */}
          <button 
            onClick={() => navigate({ to: '/faculty/subjects' })}
            className="group flex flex-col items-start p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <div className="size-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center justify-between w-full">
              My Subjects
              <ChevronRight className="size-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </h3>
            <p className="text-sm text-slate-500">
              View your officially assigned subjects and roles after HOD allocation.
            </p>
          </button>

          {/* MY TIMETABLE */}
          <button 
            onClick={() => navigate({ to: '/faculty/timetable' })}
            className="group flex flex-col items-start p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <div className="size-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Clock className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center justify-between w-full">
              My Timetable
              <ChevronRight className="size-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </h3>
            <p className="text-sm text-slate-500">
              View your personal weekly teaching timetable.
            </p>
          </button>

          {/* PROFILE */}
          <button 
            className="group flex flex-col items-start p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <div className="size-12 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <User className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center justify-between w-full">
              Profile
              <ChevronRight className="size-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </h3>
            <p className="text-sm text-slate-500">
              View your faculty details and workload constraints.
            </p>
          </button>

        </div>
      </div>
    </WorkloadShell>
  );
}
