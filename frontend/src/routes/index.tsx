import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { Building2, Users } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { demoSignIn, isLoading } = useAuth();

  const handleRoleSelect = async (role: 'HOD' | 'FACULTY') => {
    try {
      await demoSignIn(role);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return null;

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-4 bg-slate-900"
      style={{
        backgroundImage: 'url(/srm-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Translucent overlay over the background image */}
      <div className="absolute inset-0 bg-[#001433]/70 backdrop-blur-sm z-0"></div>

      {/* Main Content Card (Glassmorphism) */}
      <div className="relative z-10 w-full max-w-[900px] flex flex-col md:flex-row overflow-hidden rounded-2xl shadow-2xl shadow-[#000000]/50 border border-white/10 bg-white/10 backdrop-blur-md">
        
        {/* Left Side: Branding */}
        <div className="w-full md:w-5/12 p-10 flex flex-col items-center justify-center bg-white/5 border-r border-white/10 text-center">
          <div className="size-24 rounded-2xl bg-white p-2 shadow-lg mb-6 overflow-hidden">
            <img 
              src="/srm-logo.jpeg" 
              alt="SRM Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            SRM University
          </h1>
          <p className="text-sm font-medium text-blue-200">
            Workload and Timetable Portal
          </p>
          <div className="mt-8 px-4 py-2 bg-blue-900/40 rounded-full border border-blue-400/20 text-xs font-bold text-blue-300 uppercase tracking-widest">
            Phase A Demo
          </div>
        </div>

        {/* Right Side: Role Selection */}
        <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white/95">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Select Role</h2>
            <p className="text-slate-500 text-sm mt-1">
              Choose a demo profile to continue. No credentials required for this demo.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleRoleSelect('HOD')}
              className="w-full group relative flex items-center p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#002147] hover:bg-blue-50 transition-all text-left"
            >
              <div className="size-12 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-[#002147] group-hover:text-white transition-colors">
                <Building2 className="size-6" />
              </div>
              <div className="ml-4">
                <p className="text-base font-bold text-slate-900 group-hover:text-[#002147]">HOD / ERP Coordinator</p>
                <p className="text-xs text-slate-500 font-medium">Manage preferences, allocate subjects, and finalize workload</p>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect('FACULTY')}
              className="w-full group relative flex items-center p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#002147] hover:bg-blue-50 transition-all text-left"
            >
              <div className="size-12 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 group-hover:bg-[#002147] group-hover:text-white transition-colors">
                <Users className="size-6" />
              </div>
              <div className="ml-4">
                <p className="text-base font-bold text-slate-900 group-hover:text-[#002147]">Faculty</p>
                <p className="text-xs text-slate-500 font-medium">Submit preferences and view assigned subjects & timetable</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
