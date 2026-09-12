import { Link, useNavigate, useRouterState, type LinkProps } from "@tanstack/react-router";
import { LogOut, Menu, GraduationCap, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/erp-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: ReactNode;
}

interface Props {
  role: Role;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
}

export function PortalShell({ role, title, subtitle, nav, children }: Props) {
  const { session, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && (!session || session.role !== role)) {
      navigate({ to: "/", replace: true });
    }
  }, [ready, session, role, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!ready || !session || session.role !== role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">SRM University</p>
            <p className="truncate text-xs text-sidebar-foreground/70">Timetable &amp; Workload ERP</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {title}
          </p>
          {nav.map((item) => (
            <Link
              key={String(item.to)}
              to={item.to}
              activeOptions={{ exact: String(item.to).split("/").length <= 2 }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 rounded-md bg-sidebar-accent px-3 py-2.5">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{session.name}</p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/60">{role} account</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => {
              signOut();
              navigate({ to: "/", replace: true });
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-4 shadow-sm sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
