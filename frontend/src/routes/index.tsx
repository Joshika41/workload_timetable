import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Landmark,
  LogIn,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/erp-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign In - SRM Timetable & Workload ERP" },
      {
        name: "description",
        content:
          "Select your role to instantly access the SRM University timetable and workload management system.",
      },
    ],
  }),
  component: RoleSelection,
});

const ROLES: {
  role: Role;
  title: string;
  blurb: string;
  icon: typeof ShieldCheck;
  hint: string;
}[] = [
  {
    role: "admin",
    title: "Admin",
    blurb:
      "Upload syllabi, configure faculty workload, generate and publish master timetables.",
    icon: ShieldCheck,
    hint: "Click to auto-login as Admin",
  },
  {
    role: "faculty",
    title: "Faculty",
    blurb:
      "Submit subject preferences and review your personal teaching schedule.",
    icon: BookOpen,
    hint: "Click to auto-login as Faculty",
  },
  {
    role: "dean",
    title: "Dean",
    blurb:
      "Institution-wide oversight of workload distribution, conflicts and timetables.",
    icon: Landmark,
    hint: "Click to auto-login as Dean",
  },
];

const HOME: Record<Role, string> = {
  admin: "/admin",
  faculty: "/faculty",
  dean: "/dean",
};

function RoleSelection() {
  const { session, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState<Role | null>(null);

  useEffect(() => {
    if (ready && session) navigate({ to: HOME[session.role], replace: true });
  }, [ready, session, navigate]);

  async function openRole(role: Role) {
    setLoadingRole(role);
    
    // Auto credentials mapping
    const autoCreds = {
      admin: { u: "admin@srm.edu", p: "admin123" },
      faculty: { u: "faculty@srm.edu", p: "faculty123" },
      dean: { u: "admin@srm.edu", p: "admin123" } // Default fallback
    };
    
    const creds = autoCreds[role];
    const result = await signIn(creds.u, creds.p, role);
    
    setLoadingRole(null);
    if (result.ok) {
      navigate({ to: HOME[role], replace: true });
    } else {
      alert("Auto-login failed: " + result.error);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--gradient-institutional)" }}
    >
      <header className="mb-10 max-w-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20">
          <GraduationCap className="size-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          Timetable &amp; Workload Management
        </h1>
        <p className="mt-3 text-sm text-primary-foreground/70 sm:text-base">
          SRM University - Office of Academic Scheduling. Choose your role to continue.
        </p>
      </header>

      <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
        {ROLES.map(({ role, title, blurb, icon: Icon, hint }) => (
          <button
            key={role}
            onClick={() => openRole(role)}
            disabled={loadingRole !== null}
            className={`group rounded-xl bg-card p-6 text-left shadow-[var(--shadow-card)] ring-1 ring-border transition-all duration-300 ${loadingRole ? 'opacity-50 cursor-wait' : 'hover:-translate-y-1 hover:ring-ring hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'}`}
          >
            <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
              {loadingRole === role ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {blurb}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <LogIn className="size-4" /> Sign in as {title}
            </span>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {hint}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
