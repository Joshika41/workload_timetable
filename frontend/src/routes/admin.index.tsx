import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WorkloadShell } from "@/components/WorkloadShell";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Users,
  BookOpen,
  Layers,
  CheckCircle2,
  ChevronRight,
  Circle,
  AlertCircle,
} from "lucide-react";
import { preferenceApi } from "@/api/preferenceApi";
import { apiClient } from "@/api/client";

export const Route = createFileRoute("/admin/")({
  component: HodDashboardPage,
});

function HodDashboardPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

  const [prefSubmissions, setPrefSubmissions] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setIsLoading(true);

    Promise.all([
      preferenceApi.getAllPreferences(activeWorkspace.workspace_id).catch(() => []),
      apiClient.get("/faculty", { params: { department_id: activeWorkspace.department_id } }).then(r => r.data).catch(() => []),
      apiClient.get("/allocations", { params: { workspace_id: activeWorkspace.workspace_id } }).then(r => r.data).catch(() => []),
    ]).then(([prefs, faculty, allocs]) => {
      setPrefSubmissions(Array.isArray(prefs) ? prefs : []);
      setFacultyList(Array.isArray(faculty) ? faculty : []);
      setAllocations(Array.isArray(allocs) ? allocs : []);
    }).finally(() => setIsLoading(false));
  }, [activeWorkspace]);

  // WorkloadShell handles the no-workspace case with WorkspaceSelector
  // DO NOT return null here — let WorkloadShell decide

  const workflowState = activeWorkspace?.workflow_state || "PREFERENCES";
  const isFinalized = workflowState === "FINALIZED";
  const prefsSubmitted = prefSubmissions.length;
  const totalFaculty = facultyList.length;
  const allocatedCount = allocations.filter((a: any) => a.status === "ALLOCATED" || a.status === "FINALIZED").length;
  const totalSections = activeWorkspace?.sections?.length || 0;

  const stages = [
    { id: 1, label: "Faculty\nPreferences", key: "PREFERENCES" },
    { id: 2, label: "Preference\nReview", key: "REVIEW" },
    { id: 3, label: "Subject\nAllocation", key: "ALLOCATION" },
    { id: 4, label: "Finalization", key: "FINALIZED" },
    { id: 5, label: "Workload", key: "WORKLOAD" },
    { id: 6, label: "Class-Wise\nMatrix", key: "MATRIX" },
  ];

  const stageOrder = ["PREFERENCES", "REVIEW", "ALLOCATION", "FINALIZED", "WORKLOAD", "MATRIX"];
  const currentStageIdx = stageOrder.indexOf(workflowState);

  function getStageStatus(stageKey: string) {
    const stageIdx = stageOrder.indexOf(stageKey);
    if (stageIdx < currentStageIdx) return "done";
    if (stageIdx === currentStageIdx) return "active";
    return "pending";
  }

  function getNextAction() {
    if (prefsSubmitted === 0) {
      return {
        message: "No faculty preferences submitted yet. Preferences submitted by faculty will appear here.",
        action: "View Faculty Preferences",
        to: "/admin/preferences",
        variant: "outline" as const,
      };
    }
    if (!isFinalized && allocatedCount === 0) {
      return {
        message: `${prefsSubmitted} ${prefsSubmitted === 1 ? "faculty member has" : "faculty members have"} submitted preferences. Review them before proceeding to Subject Allocation.`,
        action: "Review Preferences",
        to: "/admin/preferences",
        variant: "default" as const,
      };
    }
    if (!isFinalized) {
      return {
        message: `Preferences reviewed. Proceed to allocate subjects across all sections.`,
        action: "Go to Subject Allocation",
        to: "/admin/allocation",
        variant: "default" as const,
      };
    }
    return {
      message: "Allocation is finalized. Workload and Class-Wise Matrix are now available.",
      action: "View Workload",
      to: "/admin/workload",
      variant: "default" as const,
    };
  }

  const nextAction = getNextAction();

  return (
    <WorkloadShell
      role="admin"
      title={activeWorkspace?.department_name || "HOD Home"}
      subtitle={
        activeWorkspace
          ? `${activeWorkspace.programme_name} | Year ${activeWorkspace.programme_year} | Semester ${activeWorkspace.semester} | ${activeWorkspace.semester_type === "ODD" ? "Odd" : "Even"} Semester | ${activeWorkspace.academic_year_name}`
          : undefined
      }
    >
      <div className="space-y-6">
        {/* WORKFLOW TRACKER */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">
            Current Workflow
          </h2>

          <div className="flex items-start justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-[8%] right-[8%] h-[2px] bg-slate-100 z-0" />

            {stages.map((stage, idx) => {
              const status = getStageStatus(stage.key);
              return (
                <div key={stage.id} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                  <div
                    className={`size-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      status === "active"
                        ? "bg-[#002147] border-[#002147] text-white shadow-lg shadow-blue-900/30"
                        : status === "done"
                        ? "bg-blue-50 border-blue-300 text-blue-600"
                        : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="size-5 text-blue-500" />
                    ) : status === "active" ? (
                      stage.id
                    ) : (
                      <Circle className="size-5 text-slate-300" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold text-center whitespace-pre-line leading-tight ${
                      status === "active"
                        ? "text-[#002147]"
                        : status === "done"
                        ? "text-blue-500"
                        : "text-slate-400"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* What needs your attention */}
          <div className="mt-8 bg-amber-50/60 border border-amber-200/60 rounded-xl p-6 flex flex-col items-center text-center">
            <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
              <ClipboardList className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">What needs your attention?</h3>
            <p className="text-sm text-slate-600 mb-5 max-w-lg">{nextAction.message}</p>
            <Button
              variant={nextAction.variant}
              onClick={() => navigate({ to: nextAction.to })}
              className={
                nextAction.variant === "default"
                  ? "bg-[#002147] hover:bg-[#001a38] text-white"
                  : "border-slate-300 text-slate-700 bg-white"
              }
            >
              {nextAction.action} <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* LIVE SUMMARY */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
            Live Summary
          </h2>

          {isLoading ? (
            <div className="text-sm text-slate-500 text-center py-4">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Faculty</p>
                  <p className="text-xl font-black text-slate-900">{totalFaculty || "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Preferences Submitted</p>
                  <p className="text-xl font-black text-slate-900">
                    <span className="text-teal-600">{prefsSubmitted}</span>
                    {totalFaculty > 0 && (
                      <span className="text-slate-400 text-base"> / {totalFaculty}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Subjects / Offerings</p>
                  <p className="text-xl font-black text-slate-900">{allocations.length > 0 ? allocations.length : "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Layers className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Sections</p>
                  <p className="text-xl font-black text-slate-900">{totalSections || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkloadShell>
  );
}
