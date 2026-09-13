import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  LogIn,
  Users,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Building,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWorkloadData } from '@/lib/workload-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Sign In · SRM Faculty Preference & Workload ERP' },
      {
        name: 'description',
        content:
          'Sign in to the SRM University Faculty Preference and Workload Management Portal.',
      },
    ],
  }),
  component: RoleSelection,
});

function RoleSelection() {
  const navigate = useNavigate();
  const { facultyList, setCurrentFacultyId } = useWorkloadData();

  const [activeRole, setActiveRole] = useState<'admin' | 'faculty' | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('FAC007'); // Dr.S.Meenakshi
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');

  const handleQuickLoginHOD = () => {
    navigate({ to: '/admin' });
  };

  const handleQuickLoginFaculty = (facultyId: string) => {
    setCurrentFacultyId(facultyId);
    navigate({ to: '/faculty/dashboard' });
  };

  return (
    <div className="min-h-screen bg-[#002147] flex flex-col justify-between text-white relative overflow-hidden">
      {/* Background aesthetic grid overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-blue-900/60 z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-teal-400/20 text-teal-300 border border-teal-400/40 flex items-center justify-center font-bold">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider uppercase">
              SRM Institute of Science and Technology
            </h1>
            <p className="text-xs text-blue-200">
              Department of Computer Applications · MCA &amp; MCA GEN AI
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 text-xs font-bold rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
          Academic Year 2026-2027
        </span>
      </header>

      {/* Main Portal Selection */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-5xl mx-auto w-full z-10">
        <div className="text-center space-y-3 mb-10">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-white/10 text-teal-300 border border-white/10 tracking-wider uppercase">
            Official University System
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Faculty Preference &amp; Workload Management
          </h2>
          <p className="text-sm sm:text-base text-blue-200/80 max-w-2xl mx-auto">
            Automating subject willingness collection, departmental faculty allocation, and instant workload calculations under the 2025 SRM MCA Syllabus.
          </p>
        </div>

        <div className="grid w-full sm:grid-cols-2 gap-6 max-w-3xl">
          {/* HOD / Administrator Card */}
          <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-xl border border-slate-200 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <div>
              <div className="size-12 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-4">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Head of Department (HOD)
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Review faculty subject preferences, configure course &amp; section allocations, balance theory/lab teaching hours, and export official workload sheets.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <Button
                onClick={handleQuickLoginHOD}
                className="w-full bg-[#002147] hover:bg-[#001833] text-white font-bold text-xs h-10 gap-2"
              >
                <span>Enter HOD Console</span>
                <ArrowRight className="size-4 text-teal-300" />
              </Button>
              <p className="text-[11px] text-center text-slate-400">
                Full administrative &amp; allocation access
              </p>
            </div>
          </div>

          {/* Faculty Member Card */}
          <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-xl border border-slate-200 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <div>
              <div className="size-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center mb-4">
                <BookOpen className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Faculty Member Portal
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Browse syllabus courses by category (Core, Elective, Skill, etc.), submit ranked subject preferences (1 to 5), and review your personal teaching allocation.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500">
                  Select Faculty Profile for Instant Access:
                </Label>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  className="w-full h-8 text-xs font-semibold rounded border border-slate-200 bg-slate-50 px-2"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.designation} · {f.programme})
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => handleQuickLoginFaculty(selectedFacultyId)}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs h-10 gap-2"
              >
                <span>Enter Faculty Workspace</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 18 Faculty Quick Switcher Bar */}
        <div className="mt-10 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 w-full max-w-4xl text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-300">
            Quick Faculty Profiles (18 Seeded Staff Members)
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 max-h-24 overflow-y-auto pt-1">
            {facultyList.map((f) => (
              <button
                key={f.id}
                onClick={() => handleQuickLoginFaculty(f.id)}
                className="px-2.5 py-1 text-[11px] rounded bg-white/10 hover:bg-white/20 text-blue-100 transition-colors border border-white/5 truncate max-w-[200px]"
                title={`${f.name} (${f.designation})`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-blue-200/60 border-t border-blue-900/40 z-10">
        © {new Date().getFullYear()} SRM Institute of Science and Technology · Faculty Preference &amp; Workload ERP
      </footer>
    </div>
  );
}
