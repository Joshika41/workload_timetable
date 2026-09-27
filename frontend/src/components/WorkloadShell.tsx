import { Link, useNavigate, type LinkProps } from '@tanstack/react-router';
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  SlidersHorizontal,
  BarChart3,
  Table2,
  User,
  BookOpen,
  Clock,
  Building2,
  Layers,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/context/WorkspaceContext';
import { academicApi } from '@/api/academicApi';
import type { AcademicWorkspaceResponse } from '@/types/academic';
import { WorkspaceSelector } from '@/components/WorkspaceSelector';
import { cn } from '@/lib/utils';

export interface WorkloadNavItem {
  to: NonNullable<LinkProps['to']>;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

interface NavGroup {
  groupTitle?: string;
  items: WorkloadNavItem[];
}

interface Props {
  role: 'admin' | 'faculty';
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function WorkloadShell({ role, title, subtitle, children, actions }: Props) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<AcademicWorkspaceResponse[]>([]);
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();

  // Proper top-level useEffect — NOT inside a dynamic import Promise (was Bug #2)
  useEffect(() => {
    if (role === 'admin') {
      academicApi.getWorkspaces()
        .then(setWorkspaces)
        .catch(console.error);
    }
  }, [role]);

  const isHod = role === 'admin';
  const displayName = session?.name || session?.username || (isHod ? 'HOD' : 'Faculty');
  const displayRole = isHod ? 'Head of Department' : 'Faculty Member';

  // HOD Navigation per spec: Home | Faculty Preferences | Subject Allocation | Workload | Class-Wise Matrix | Profile
  const hodNavGroups: NavGroup[] = [
    {
      items: [
        { to: '/admin', label: 'Home', icon: <LayoutDashboard className="size-4" /> },
      ],
    },
    {
      groupTitle: 'Workload Management',
      items: [
        { to: '/admin/preferences', label: 'Faculty Preferences', icon: <ClipboardList className="size-4" /> },
        { to: '/admin/allocation', label: 'Subject Allocation', icon: <SlidersHorizontal className="size-4" /> },
        { to: '/admin/workload', label: 'Workload', icon: <BarChart3 className="size-4" /> },
        { to: '/admin/classmatrix', label: 'Class-Wise Matrix', icon: <Table2 className="size-4" /> },
      ],
    },
    {
      items: [
        { to: '/admin/profile', label: 'Profile', icon: <User className="size-4" /> },
      ],
    },
  ];

  // Faculty Navigation per spec: Home | My Preferences | My Subjects | My Timetable | Profile
  const facultyNavGroups: NavGroup[] = [
    {
      items: [
        { to: '/faculty/dashboard', label: 'Home', icon: <LayoutDashboard className="size-4" /> },
        { to: '/faculty/preferences', label: 'My Preferences', icon: <ClipboardList className="size-4" /> },
        { to: '/faculty/subjects', label: 'My Subjects', icon: <BookOpen className="size-4" /> },
        { to: '/faculty/timetable', label: 'My Timetable', icon: <Clock className="size-4" /> },
        { to: '/faculty/profile', label: 'Profile', icon: <User className="size-4" /> },
      ],
    },
  ];

  const activeNavGroups = isHod ? hodNavGroups : facultyNavGroups;

  if (!activeWorkspace) {
    return <WorkspaceSelector role={role} onWorkspaceSelected={setActiveWorkspace} />;
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: "url(/srm-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}><div className="absolute inset-0 bg-slate-100/90 backdrop-blur-md z-0" /><div className="relative z-10 flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-[#002147] text-white shadow-md">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md hover:bg-white/10"
              aria-label="Toggle Navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white rounded-lg flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                <img src="/srm-logo.jpeg" alt="SRM University Logo" className="w-full h-full object-contain" />
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="font-bold text-xs uppercase tracking-wide text-white">SRM University</p>
                <p className="text-[10px] text-blue-300 font-medium">Workload and Timetable Portal</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <span className="text-xs font-bold tracking-widest uppercase text-blue-300/80">
              {isHod ? 'HOD / ERP Coordinator' : 'Faculty Portal'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isHod && workspaces.length > 1 && (
              <select
                className="hidden lg:block h-8 rounded border border-blue-700 bg-blue-900/50 text-white text-xs px-2 max-w-[200px]"
                value={activeWorkspace.workspace_id}
                onChange={(e) => {
                  const ws = workspaces.find(w => w.workspace_id === e.target.value);
                  if (ws) setActiveWorkspace(ws);
                }}
              >
                {workspaces.map(ws => (
                  <option key={ws.workspace_id} value={ws.workspace_id}>
                    {ws.programme_name} Yr{ws.programme_year} Sem{ws.semester}
                  </option>
                ))}
              </select>
            )}
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-blue-800/80">
              <div className="size-8 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center font-bold text-xs text-teal-300 uppercase">
                {displayName.slice(0, 2)}
              </div>
              <div className="text-xs leading-tight">
                <p className="font-semibold text-white">{displayName}</p>
                <p className="text-[10px] text-teal-300">{displayRole}</p>
              </div>
            </div>
            <button
              onClick={() => { signOut(); navigate({ to: '/' }); }}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded text-blue-200 hover:text-white hover:bg-white/10 text-xs transition-colors"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
        <div className="bg-[#001433] border-t border-blue-950 px-6 py-1.5 flex items-center gap-1.5 text-[11px] text-blue-300 overflow-x-auto whitespace-nowrap">
          <Building2 className="size-3 text-blue-400 shrink-0" />
          <span className="font-medium">{activeWorkspace.department_name}</span>
          <span className="text-blue-700 mx-1">|</span>
          <span>{activeWorkspace.programme_name}</span>
          <span className="text-blue-700 mx-1">|</span>
          <span>Year {activeWorkspace.programme_year}</span>
          <span className="text-blue-700 mx-1">|</span>
          <span>Semester {activeWorkspace.semester}</span>
          <span className="text-blue-700 mx-1">|</span>
          <span>{activeWorkspace.semester_type === 'ODD' ? 'Odd' : 'Even'} Semester</span>
          <span className="text-blue-700 mx-1">|</span>
          <span className="font-semibold text-teal-400">{activeWorkspace.academic_year_name}</span>
          {activeWorkspace.sections && activeWorkspace.sections.length > 0 && (
            <>
              <span className="text-blue-700 mx-1">|</span>
              <Layers className="size-3 text-blue-400 shrink-0" />
              <span className="text-teal-300">Sections: {activeWorkspace.sections.map(s => s.name).join(', ')}</span>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-60 bg-white/70 backdrop-blur-lg border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 pt-[89px] lg:pt-0',
            mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          )}
        >
          <div className="lg:hidden flex items-center justify-between p-4 border-b bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation</span>
            <button onClick={() => setMobileMenuOpen(false)}>
              <X className="size-5 text-slate-600" />
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-blue-50/60 to-white">
            <p className="text-[10px] font-bold text-[#002147]/50 uppercase tracking-wider">Academic Context</p>
            <p className="text-xs font-bold text-slate-800 mt-0.5 leading-snug">{activeWorkspace.programme_name}</p>
            <p className="text-[11px] text-slate-500">Yr {activeWorkspace.programme_year} | Sem {activeWorkspace.semester} | {activeWorkspace.academic_year_name}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="size-2 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-[11px] text-emerald-700 font-semibold capitalize">
                {(activeWorkspace.workflow_state || 'PREFERENCES').toLowerCase().replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {activeNavGroups.map((group, gIdx) => (
              <div key={gIdx} className={gIdx > 0 ? 'mt-4' : ''}>
                {group.groupTitle && (
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.groupTitle}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item, iIdx) => (
                    <Link
                      key={iIdx}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-blue-50 hover:text-[#002147] transition-colors"
                      activeProps={{ className: 'bg-[#002147] text-white hover:bg-[#001a38] hover:text-white' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="shrink-0">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-800">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span>Role:</span>
                <span className="font-semibold text-slate-700">{isHod ? 'HOD' : 'Faculty'}</span>
              </div>
              <div className="flex justify-between">
                <span>User:</span>
                <span className="font-semibold text-slate-700 truncate max-w-[100px]" title={displayName}>{displayName}</span>
              </div>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden" />
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="bg-white/70 backdrop-blur-lg border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm shrink-0">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </div>
        </main></div></div></div>
  );
}

