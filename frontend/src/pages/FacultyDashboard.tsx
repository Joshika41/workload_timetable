import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/academicApi';
import { AcademicWorkspaceResponse, DepartmentResponse } from '@/types/academic';
import { BookOpen, Layers, Select, ChevronRight, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FacultyDashboard() {
  const { user, logOut, workspaceFilters } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<AcademicWorkspaceResponse[]>([]);
  const [department, setDepartment] = useState<DepartmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    academicApi.getDepartments().then(depts => {
      const currentDept = depts.find(d => d.id === user?.department_id);
      if (currentDept) setDepartment(currentDept);
    });

    academicApi.getWorkspaces().then(data => {
      setWorkspaces(data);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [user]);

  const filteredWorkspaces = workspaces.filter(w => {
    if (!workspaceFilters) return true;
    
    if (department && workspaceFilters.programmeType) {
      const prog = department.programmes.find(p => p.id === w.programme_id);
      if (prog && prog.programme_type !== workspaceFilters.programmeType) {
        return false;
      }
    }
    
    return w.semester_type === workspaceFilters.semesterType;
  }).sort((a, b) => a.semester - b.semester);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#002147] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <div className="size-10 bg-white rounded flex items-center justify-center">
            <img src="/srm-logo.jpeg" alt="SRM Logo" className="size-8 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Faculty Portal</h1>
            <p className="text-xs text-blue-300">
              {department?.name} • {workspaceFilters?.programmeType} • {workspaceFilters?.semesterType === 'ODD' ? 'Odd Semesters' : 'Even Semesters'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-blue-300">Faculty</p>
          </div>
          <Button variant="outline" className="text-[#002147] bg-white hover:bg-slate-100 border-none" onClick={logOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8">
        
        {/* Context Info Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#002147]">{department?.name}</h2>
            <div className="flex gap-3 mt-2">
              <span className="px-3 py-1 bg-teal-50 text-teal-700 text-sm font-bold rounded-full border border-teal-100">
                {workspaceFilters?.programmeType}
              </span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-full border border-emerald-100">
                {workspaceFilters?.semesterType === 'ODD' ? 'Odd Semesters' : 'Even Semesters'}
              </span>
            </div>
          </div>
          
          <Button variant="outline" onClick={logOut} className="border-slate-300">
            Change Context
          </Button>
        </div>

        {/* Semester Cards */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="size-5 text-teal-600" />
            Available Semesters
          </h3>
          
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading workspaces...</div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed text-slate-500">
              No workspaces found for the selected criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkspaces.map(ws => (
                <div 
                  key={ws.workspace_id} 
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-teal-200 transition-all cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/faculty/workspace/${ws.workspace_id}`)}
                >
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="size-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <GraduationCap className="size-6" />
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        ws.workflow_state === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ws.workflow_state}
                      </span>
                    </div>
                    
                    <h4 className="text-2xl font-black text-slate-900 mb-1">
                      Semester {ws.semester}
                    </h4>
                    <p className="text-sm font-semibold text-slate-500 mb-4">
                      {ws.programme_name} (Year {ws.programme_year})
                    </p>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Academic Year</span>
                        <span className="font-semibold text-slate-900">{ws.academic_year_name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-900">
                          {ws.workflow_state === 'FINALIZED' ? 'View My Subjects' : 'Submit Preferences'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between group-hover:bg-teal-50 transition-colors">
                    <span className="text-sm font-bold text-slate-600 group-hover:text-teal-700">Enter Workspace</span>
                    <ChevronRight className="size-5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
