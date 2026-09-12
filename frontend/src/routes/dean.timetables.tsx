import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { deanNav } from "@/components/portal-nav";
import { TimetableGrid } from "@/components/TimetableGrid";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Slot } from "@/lib/erp-data";

export const Route = createFileRoute("/dean/timetables")({
  head: () => ({
    meta: [
      { title: "Universal Timetables · Dean · SRM ERP" },
      {
        name: "description",
        content:
          "View published six-period timetables for every institutional section in a read-only oversight mode.",
      },
      { property: "og:title", content: "Universal Timetables · Dean · SRM ERP" },
      {
        property: "og:description",
        content: "Read-only institutional timetables across all sections.",
      },
    ],
  }),
  component: DeanTimetables,
});

function DeanTimetables() {
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

  const grid = useMemo(() => {
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

  return (
    <PortalShell
      role="dean"
      title="Universal Institutional Timetables"
      subtitle="Read-only · all sections, Monday to Friday, 6 periods"
      nav={deanNav}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
          {sections.length === 0 && <span className="text-sm text-muted-foreground p-2">No sections generated yet. Generate the timetable first.</span>}
          {sections.map((s: string) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                s === section
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">{section}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Lock className="size-3.5" /> View only
            </span>
          </div>
          <TimetableGrid grid={grid} showFaculty />
        </div>
      </div>
    </PortalShell>
  );
}
