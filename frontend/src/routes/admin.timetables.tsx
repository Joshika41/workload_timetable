import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { TimetableGrid } from "@/components/TimetableGrid";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Slot } from "@/lib/erp-data";
import { Button } from "@/components/ui/button";
import html2pdf from "html2pdf.js";

export const Route = createFileRoute("/admin/timetables")({
  head: () => ({
    meta: [
      { title: "Master Class Timetables · Admin · SRM ERP" },
      {
        name: "description",
        content:
          "Review published six-period master timetables for every MCA section with venue and lab allocations.",
      },
      { property: "og:title", content: "Master Class Timetables · Admin · SRM ERP" },
      {
        property: "og:description",
        content: "Six-period master timetables for every section with venue and lab allocations.",
      },
    ],
  }),
  component: MasterTimetables,
});

function MasterTimetables() {
  const { session } = useAuth();
  
  // Fetch metadata to get sections
  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: async () => {
      const res = await api.get("/api/timetable/metadata");
      return res.data;
    }
  });

  const sections = metadata?.sections || [];
  const [section, setSection] = useState("");

  // Auto-select first section when loaded
  useMemo(() => {
    if (sections.length > 0 && !section) {
      setSection(sections[0]);
    }
  }, [sections, section]);

  // Fetch all timetable blocks
  const { data: allBlocks, isLoading } = useQuery({
    queryKey: ["admin-timetable"],
    queryFn: async () => {
      const res = await api.get("/api/admin/timetable");
      return res.data;
    }
  });

  // Convert flat blocks to grid structure (5 days x 6 periods)
  const grid = useMemo(() => {
    const defaultGrid: (Slot | null)[][] = Array(5).fill(null).map(() => Array(6).fill(null));
    if (!allBlocks || !section) return defaultGrid;
    
    allBlocks.forEach((block: any) => {
      if (block.section === section) {
        if (block.day >= 0 && block.day < 5 && block.period >= 0 && block.period < 6) {
          defaultGrid[block.day][block.period] = {
            subject: block.subject,
            venue: "", // Backend might not have venues attached directly to the block yet
            faculty: block.faculty_id,
            section: block.section
          };
        }
      }
    });
    return defaultGrid;
  }, [allBlocks, section]);

  const exportPDF = () => {
    const element = document.getElementById("timetable-export-container");
    if (!element) return;
    const opt = {
      margin: 0.5,
      filename: `timetable_${section}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "landscape" },
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <PortalShell
      role="admin"
      title="Master Class Timetables"
      subtitle={session?.department ?? "All institutional sections"}
      nav={adminNav}
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
            <div>
              <h2 className="text-lg font-semibold text-foreground">{section}</h2>
              <p className="text-sm text-muted-foreground">
                Monday to Friday · exactly 6 periods per day · labs de-duplicated
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="outline" onClick={exportPDF}>
                Export PDF
              </Button>
              <span className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                Published
              </span>
            </div>
          </div>
          <div id="timetable-export-container">
            <TimetableGrid grid={grid} showFaculty />
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
