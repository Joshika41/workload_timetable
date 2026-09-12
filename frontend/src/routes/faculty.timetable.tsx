import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { facultyNav } from "@/components/portal-nav";
import { TimetableGrid } from "@/components/TimetableGrid";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Slot } from "@/lib/erp-data";

export const Route = createFileRoute("/faculty/timetable")({
  head: () => ({
    meta: [
      { title: "My Timetable · Faculty · SRM ERP" },
      {
        name: "description",
        content:
          "Personal five-day, six-period teaching schedule with section and venue details, plus class schedule views.",
      },
      { property: "og:title", content: "My Timetable · Faculty · SRM ERP" },
      {
        property: "og:description",
        content: "Personal weekly teaching schedule with sections and venues.",
      },
    ],
  }),
  component: FacultyTimetable,
});

function FacultyTimetable() {
  const { session } = useAuth();
  const [view, setView] = useState<"mine" | "class">("mine");
  const name = session?.name ?? "";

  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: async () => {
      const res = await api.get("/api/timetable/metadata");
      return res.data;
    }
  });

  const sections = metadata?.sections || [];
  const [section, setSection] = useState("");

  useMemo(() => {
    if (sections.length > 0 && !section) {
      setSection(sections[0]);
    }
  }, [sections, section]);

  const { data: allBlocks } = useQuery({
    queryKey: ["admin-timetable"],
    queryFn: async () => {
      const res = await api.get("/api/admin/timetable");
      return res.data;
    }
  });

  const mine = useMemo(() => {
    const defaultGrid: (Slot | null)[][] = Array(5).fill(null).map(() => Array(6).fill(null));
    if (!allBlocks || !name) return defaultGrid;
    
    allBlocks.forEach((block: any) => {
      // Assuming session.name matches faculty_id or faculty name.
      // In a real app we'd use session.username/id.
      if (block.faculty_id === name || block.faculty_id.includes(name)) {
        if (block.day >= 0 && block.day < 5 && block.period >= 0 && block.period < 6) {
          defaultGrid[block.day][block.period] = {
            subject: block.subject,
            venue: "",
            faculty: block.faculty_id,
            section: block.section
          };
        }
      }
    });
    return defaultGrid;
  }, [allBlocks, name]);

  const classGrid = useMemo(() => {
    const defaultGrid: (Slot | null)[][] = Array(5).fill(null).map(() => Array(6).fill(null));
    if (!allBlocks || !section) return defaultGrid;
    
    allBlocks.forEach((block: any) => {
      if (block.section === section) {
        if (block.day >= 0 && block.day < 5 && block.period >= 0 && block.period < 6) {
          defaultGrid[block.day][block.period] = {
            subject: block.subject,
            venue: "",
            faculty: block.faculty_id,
            section: block.section
          };
        }
      }
    });
    return defaultGrid;
  }, [allBlocks, section]);

  const totalHours = mine.flat().filter(Boolean).length;

  return (
    <PortalShell
      role="faculty"
      title="Faculty Timetable"
      subtitle={`${name} · ${totalHours} contact hours per week`}
      nav={facultyNav}
    >
      <div className="space-y-5">
        <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-card)]">
          {(
            [
              ["mine", "My Schedule"],
              ["class", "Class Schedules"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                view === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "class" ? (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
            {sections.length === 0 && <span className="text-sm text-muted-foreground p-2">No sections generated yet.</span>}
            {sections.map((s: string) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  s === section
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {view === "mine" ? "My Weekly Schedule" : `${section} — Class Schedule`}
          </h2>
          {view === "mine" ? (
            <TimetableGrid grid={mine} showSection />
          ) : (
            <TimetableGrid grid={classGrid} showFaculty />
          )}
        </div>
      </div>
    </PortalShell>
  );
}
