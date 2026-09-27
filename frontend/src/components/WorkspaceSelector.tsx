import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/academicApi';
import type { AcademicWorkspaceResponse } from '@/types/academic';
import { GraduationCap, ArrowRight, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  role: 'admin' | 'faculty';
  onWorkspaceSelected: (workspace: AcademicWorkspaceResponse) => void;
}

export function WorkspaceSelector({ role, onWorkspaceSelected }: Props) {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<AcademicWorkspaceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedProgType, setSelectedProgType] = useState<string>('Postgraduate');
  const [selectedProg, setSelectedProg] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSem, setSelectedSem] = useState<string>('');
  const [selectedAcadYear, setSelectedAcadYear] = useState<string>('');

  useEffect(() => {
    academicApi.getWorkspaces()
      .then(data => {
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedDept(data[0].department_name);
          setSelectedProg(data[0].programme_name);
          setSelectedYear(data[0].programme_year.toString());
          setSelectedSem(data[0].semester.toString());
          setSelectedAcadYear(data[0].academic_year_name);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const matchedWorkspace = useMemo(() => {
    return workspaces.find(w => 
      w.department_name === selectedDept &&
      w.programme_name === selectedProg &&
      w.programme_year.toString() === selectedYear &&
      w.semester.toString() === selectedSem &&
      w.academic_year_name === selectedAcadYear
    );
  }, [workspaces, selectedDept, selectedProg, selectedYear, selectedSem, selectedAcadYear]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading academic context...</div>;
  }

  const uniqueDepartments = Array.from(new Set(workspaces.map(w => w.department_name)));
  const uniqueProgrammes = Array.from(new Set(workspaces.filter(w => w.department_name === selectedDept).map(w => w.programme_name)));
  const uniqueYears = Array.from(new Set(workspaces.filter(w => w.programme_name === selectedProg).map(w => w.programme_year.toString())));
  const uniqueSems = Array.from(new Set(workspaces.filter(w => w.programme_year.toString() === selectedYear).map(w => w.semester.toString())));
  const uniqueAcadYears = Array.from(new Set(workspaces.map(w => w.academic_year_name)));

  return (
    <div 
      className="min-h-screen relative flex flex-col bg-slate-900"
      style={{
        backgroundImage: 'url(/srm-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-[#001433]/70 backdrop-blur-sm z-0"></div>
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-white/10 backdrop-blur-md text-white shadow-md border-b border-white/20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-teal-400/20 text-teal-300 border border-teal-400/40 flex items-center justify-center font-bold">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wider uppercase">
                SRM Institute of Science and Technology
              </h1>
              <p className="text-xs text-blue-200 uppercase font-bold tracking-wider mt-0.5">
                WORKLOAD AND TIMETABLE PORTAL
              </p>
            </div>
          </div>
          <div className="text-right text-xs font-semibold">
            {role === 'admin' ? 'Dr. H. O. D (HOD)' : 'Faculty Portal'}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid lg:grid-cols-3 gap-8">
          
          {/* Left Form Panel */}
          <div className="lg:col-span-2 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Select Academic {role === 'admin' ? 'Workspace' : 'Context'}</h2>
            <p className="text-sm text-slate-500 mb-8">Choose the department and academic context you want to manage.</p>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Department</Label>
                <select 
                  className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Programme Type</Label>
                  <select 
                    className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                    value={selectedProgType}
                    onChange={(e) => setSelectedProgType(e.target.value)}
                  >
                    <option value="Postgraduate">Postgraduate</option>
                    <option value="Undergraduate">Undergraduate</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Programme</Label>
                  <select 
                    className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                    value={selectedProg}
                    onChange={(e) => setSelectedProg(e.target.value)}
                  >
                    {uniqueProgrammes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Programme Year</Label>
                  <select 
                    className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {uniqueYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Semester</Label>
                  <select 
                    className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                    value={selectedSem}
                    onChange={(e) => setSelectedSem(e.target.value)}
                  >
                    {uniqueSems.map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Academic Year</Label>
                <select 
                  className="w-full border-slate-200 rounded-md text-sm p-2.5 bg-slate-50"
                  value={selectedAcadYear}
                  onChange={(e) => setSelectedAcadYear(e.target.value)}
                >
                  {uniqueAcadYears.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

            </div>
          </div>

          {/* Right Preview Panel */}
          <div className="bg-white/90 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-4">
                {role === 'admin' ? 'Selected Workspace' : 'Your Context'}
              </p>
              
              {matchedWorkspace ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Building className="size-5 text-blue-800 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{matchedWorkspace.department_name}</p>
                      <p className="text-sm font-semibold text-blue-700 mt-1">{matchedWorkspace.programme_name}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Year {matchedWorkspace.programme_year} • Semester {matchedWorkspace.semester} • {matchedWorkspace.semester_type === 'ODD' ? 'Odd' : 'Even'}
                      </p>
                    </div>
                  </div>
                  
                  {role === 'admin' && matchedWorkspace.sections && (
                    <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs font-bold text-slate-700 mb-2">Applicable Sections: {matchedWorkspace.sections.length}</p>
                      <ul className="space-y-1">
                        {matchedWorkspace.sections.map(sec => (
                          <li key={sec.id} className="text-xs text-slate-600">• {sec.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No matching context found.</p>
              )}
            </div>

            <Button 
              onClick={() => matchedWorkspace && onWorkspaceSelected(matchedWorkspace)}
              disabled={!matchedWorkspace}
              className="w-full bg-[#002147] hover:bg-[#001833] text-white font-bold h-12 mt-8"
            >
              Enter Workspace
            </Button>
          </div>

        </div>
      </main>
      </div>
    </div>
  );
}
