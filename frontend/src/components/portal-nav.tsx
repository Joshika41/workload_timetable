import { CalendarDays, LayoutGrid, Users, ListChecks, CalendarRange, Building2, Database, ClipboardList, ScrollText } from "lucide-react";
import type { NavItem } from "@/components/PortalShell";

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Department Manager", icon: <Building2 className="size-4" /> },
  { to: "/admin/setup", label: "Setup & Ingestion", icon: <Database className="size-4" /> },
  { to: "/admin/preferences", label: "Preference Review", icon: <ClipboardList className="size-4" /> },
  { to: "/admin/allocation", label: "Workload Matrix", icon: <LayoutGrid className="size-4" /> },
  { to: "/admin/audit", label: "Audit Trail", icon: <ScrollText className="size-4" /> },
  { to: "/admin/faculty", label: "Faculty Management", icon: <Users className="size-4" /> },
];

export const facultyNav: NavItem[] = [
  { to: "/faculty/dashboard", label: "Subject Preferences", icon: <ListChecks className="size-4" /> },
  { to: "/faculty/timetable", label: "My Timetable", icon: <CalendarRange className="size-4" /> },
];

export const deanNav: NavItem[] = [
  { to: "/dean", label: "Institutional Oversight", icon: <LayoutGrid className="size-4" /> },
  { to: "/dean/timetables", label: "Universal Timetables", icon: <CalendarDays className="size-4" /> },
];
