import { Link, useNavigate, useRouterState, type LinkProps } from '@tanstack/react-router';
import {
  LogOut,
  Menu,
  GraduationCap,
  X,
  UserCheck,
  Building,
  RotateCcw,
  Sparkles,
  ChevronDown,
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  Clock,
  ClipboardList,
  SlidersHorizontal,
  BarChart3,
  FileSpreadsheet,
  Download,
  ShieldAlert,
  ArrowRightLeft,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useWorkloadData } from '@/lib/workload-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface WorkloadNavItem {
  to: NonNullable<LinkProps['to']>;
  label: string;
  icon: ReactNode;
  badge?: string | number | undefined;
}

export interface NavGroup {
  groupTitle?: string;
  items: WorkloadNavItem[];
}

interface Props {
  role: 'admin' | 'faculty';
  title: string;
  subtitle?: string;
  navGroups?: NavGroup[];
  children: ReactNode;
  actions?: ReactNode;
}

export function WorkloadShell({
  role,
  title,
  subtitle,
  children,
  actions,
}: Props) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchUserModalOpen, setSwitchUserModalOpen] = useState(false);

  const {
    facultyList,
    currentFacultyId,
    currentFaculty,
    setCurrentFacultyId,
    resetAllToMockData,
    dashboardMetrics,
  } = useWorkloadData();

  const isHod = role === 'admin';

  // HOD Navigation Structure
  const hodNavGroups: NavGroup[] = [
    {
      items: [
        {
          to: '/admin',
          label: 'HOD Dashboard',
          icon: <LayoutDashboard className="size-4" />,
        },
      ],
    },
    {
      groupTitle: 'Academic Setup',
      items: [
        {
          to: '/admin/setup',
          label: 'Course & Class Setup',
          icon: <BookOpen className="size-4" />,
        },
      ],
    },
    {
      groupTitle: 'Faculty Management',
      items: [
        {
          to: '/admin/faculty',
          label: 'Faculty Master & Limits',
          icon: <Users className="size-4" />,
          badge: facultyList.length,
        },
      ],
    },
    {
      groupTitle: 'Workload Management',
      items: [
        {
          to: '/admin/preferences',
          label: 'Faculty Preferences',
          icon: <ClipboardList className="size-4" />,
          badge: dashboardMetrics.pendingPreferences > 0 ? `${dashboardMetrics.pendingPreferences} Pending` : undefined,
        },
        {
          to: '/admin/allocation',
          label: 'Course Allocation',
          icon: <SlidersHorizontal className="size-4" />,
        },
        {
          to: '/admin/workload',
          label: 'Workload Sheets & Export',
          icon: <BarChart3 className="size-4" />,
        },
      ],
    },
  ];

  // Faculty Navigation Structure
  const facultyNavGroups: NavGroup[] = [
    {
      items: [
        {
          to: '/faculty/dashboard',
          label: 'Faculty Dashboard',
          icon: <LayoutDashboard className="size-4" />,
        },
        {
          to: '/faculty/dashboard',
          label: 'Subject Preference Cart',
          icon: <ClipboardList className="size-4" />,
        },
      ],
    },
  ];

  const activeNavGroups = isHod ? hodNavGroups : facultyNavGroups;

  const handleSwitchFaculty = (facId: string) => {
    setCurrentFacultyId(facId);
    const target = facultyList.find((f) => f.id === facId);
    toast.success(`Switched active faculty to ${target?.name}`);
    setSwitchUserModalOpen(false);
    if (!isHod) {
      navigate({ to: '/faculty/dashboard' });
    }
  };

  const handleResetData = () => {
    if (window.confirm('Reset all faculty allocations, preferences, and default hours to original Excel spreadsheet data?')) {
      resetAllToMockData();
      toast.success('Workload system reset to official mock data');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. TOP INSTITUTIONAL SRM HEADER */}
      {/* ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#002147] text-white shadow-md border-b border-blue-900/60">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md hover:bg-white/10 text-white"
              aria-label="Toggle Navigation"
            >
              <Menu className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center font-serif text-teal-300 font-bold text-lg">
                <GraduationCap className="size-5 text-teal-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wide text-xs sm:text-sm text-white uppercase">
                    SRM Institute of Science and Technology
                  </span>
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded">
                    MCA ERP
                  </span>
                </div>
                <p className="text-[11px] text-blue-200/80 hidden sm:block">
                  Faculty Preference &amp; Workload Management System · 2026-2027
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Role Switcher, Active User, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Switch Role CTA */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-blue-400/30 bg-white/10 text-white hover:bg-white/20 hover:text-white text-xs gap-1.5 rounded-lg"
                >
                  <ArrowRightLeft className="size-3.5 text-teal-300" />
                  <span className="hidden sm:inline">Switch Role / User</span>
                  <ChevronDown className="size-3 text-blue-300 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Switch Portal View
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    navigate({ to: '/admin' });
                  }}
                  className="gap-2 font-medium cursor-pointer"
                >
                  <Building className="size-4 text-blue-600" />
                  HOD / Administrator Console
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate({ to: '/faculty/dashboard' });
                  }}
                  className="gap-2 font-medium cursor-pointer"
                >
                  <UserCheck className="size-4 text-emerald-600" />
                  Faculty Preference Portal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Switch Active Faculty
                </DropdownMenuLabel>
                <div className="max-h-48 overflow-y-auto">
                  {facultyList.slice(0, 10).map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => handleSwitchFaculty(f.id)}
                      className={cn(
                        'text-xs cursor-pointer',
                        currentFacultyId === f.id && 'font-bold bg-blue-50 text-blue-700'
                      )}
                    >
                      {f.name} ({f.programme})
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSwitchUserModalOpen(true)}
                  className="text-xs text-primary font-medium cursor-pointer"
                >
                  View All 18 Faculty Members...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset Data Shortcut */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetData}
              title="Reset state to official mock data"
              className="h-8 px-2 text-blue-200 hover:text-white hover:bg-white/10 text-xs hidden md:flex items-center gap-1"
            >
              <RotateCcw className="size-3.5 text-amber-400" />
              <span>Reset Data</span>
            </Button>

            {/* Active User Card */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-blue-800/80 text-right">
              <div className="text-xs">
                <p className="font-semibold text-white leading-tight">
                  {isHod ? 'Dr. HOD (MCA)' : (currentFaculty?.name || 'Faculty Member')}
                </p>
                <p className="text-[10px] text-teal-300 font-mono">
                  {isHod ? 'Head of Department' : `${currentFaculty?.designation} · ${currentFaculty?.id}`}
                </p>
              </div>
              <div className="size-8 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40 flex items-center justify-center font-bold text-xs">
                {isHod ? 'HOD' : (currentFaculty?.name.charAt(3) || 'F')}
              </div>
            </div>

            {/* Sign In / Sign Out */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                signOut();
                navigate({ to: '/' });
              }}
              className="h-8 px-2.5 text-blue-200 hover:text-white hover:bg-white/10 text-xs"
            >
              <LogOut className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. BODY LAYOUT (SIDEBAR + MAIN CONTENT) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 pt-16 lg:pt-0',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Mobile close button */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation Menu</span>
            <button onClick={() => setMobileMenuOpen(false)}>
              <X className="size-5 text-slate-600" />
            </button>
          </div>

          {/* Department Scope Badge */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department Scope</p>
            <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
              PG Dept. of Computer Applications
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-block size-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-slate-600">
                Odd Semester 2026-2027
              </span>
            </div>
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeNavGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                {group.groupTitle && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.groupTitle}
                  </p>
                )}
                {group.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-blue-50 hover:text-[#002147] transition-colors data-[status=active]:bg-[#002147] data-[status=active]:text-white"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-800">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Active Profile:</span>
                <span className="font-semibold text-slate-800">{isHod ? 'HOD' : 'Faculty'}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Allocated Hours:</span>
                <span className="font-mono font-bold text-teal-700">{dashboardMetrics.allocatedHours} hrs</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Unallocated:</span>
                <span className="font-mono font-bold text-amber-700">{dashboardMetrics.unallocatedHours} hrs</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"
          />
        )}

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Top Page Banner / Title Bar */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
          </div>

          {/* Page Body */}
          <div className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Switch Faculty Modal */}
      <Dialog open={switchUserModalOpen} onOpenChange={setSwitchUserModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-600" /> Switch Faculty Profile
            </DialogTitle>
            <DialogDescription>
              Select any of the 18 faculty members to preview their personal dashboard, subject cart, and workload calculations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 max-h-96 overflow-y-auto py-2">
            {facultyList.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSwitchFaculty(f.id)}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border text-left transition-all hover:border-blue-500 hover:bg-blue-50/50',
                  currentFacultyId === f.id
                    ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white'
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                  <p className="text-xs text-slate-500">{f.designation} · {f.programme} · {f.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Default: {f.defaultWorkloadHours}h
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
