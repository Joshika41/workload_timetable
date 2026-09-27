import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { workloadApi } from '@/api/workloadApi';

export const Route = createFileRoute('/faculty/subjects')({
  component: FacultySubjectsPage,
});

function FacultySubjectsPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeWorkspace) {
      setLoading(true);
      workloadApi.getMySubjects(activeWorkspace.workspace_id)
        .then(res => setSubjects(res || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  return (
    <WorkloadShell
      role="faculty"
      title="My Subjects"
      subtitle="Your officially assigned subjects and roles"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.history.back()}
          className="h-8 gap-1 text-xs border-slate-200 bg-white"
        >
          <ArrowLeft className="size-3.5" /> Back
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto mt-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Official Subject Allocations (Finalized Workload)</h2>
        {loading ? (
           <div className="text-center p-8">Loading...</div>
        ) : subjects.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                  <th className="p-4 font-bold">Subject Code</th>
                  <th className="p-4 font-bold">Subject Name</th>
                  <th className="p-4 font-bold">Section</th>
                  <th className="p-4 font-bold">Role</th>
                  <th className="p-4 font-bold text-center">Theory Hours</th>
                  <th className="p-4 font-bold text-center">Practical Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4 text-sm font-medium">{sub.subject_code}</td>
                    <td className="p-4 text-sm text-slate-700">{sub.subject_name}</td>
                    <td className="p-4 text-sm">{sub.section}</td>
                    <td className="p-4 text-sm">{sub.role}</td>
                    <td className="p-4 text-sm text-center">{sub.theory_hours}</td>
                    <td className="p-4 text-sm text-center">{sub.practical_hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center bg-white p-12 rounded-2xl shadow-sm border border-slate-200">
            <div className="size-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="size-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">No Official Allocations Yet</h2>
            <p className="text-slate-600 text-sm mb-8 max-w-md mx-auto">
              Your subjects will appear here once the HOD finalizes the allocations for this academic context.
            </p>
            <Button 
              onClick={() => navigate({ to: '/faculty/dashboard' })}
              className="h-10 px-8 bg-[#002147] hover:bg-[#001833] text-white font-bold"
            >
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </WorkloadShell>
  );
}
