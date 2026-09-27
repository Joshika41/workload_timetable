import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WorkloadShell } from "@/components/WorkloadShell";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Clock, BookOpen, Layers, Download } from "lucide-react";
import { workloadApi } from "@/api/workloadApi";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/workload")({
  component: AdminWorkloadPage,
});

function AdminWorkloadPage() {
  const { activeWorkspace } = useWorkspace();
  const [workloads, setWorkloads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    workloadApi
      .getFacultyWorkloads(activeWorkspace.workspace_id)
      .then((data) => {
        setWorkloads(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [activeWorkspace]);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const blob = await workloadApi.exportPdf();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workload_${activeWorkspace?.department_name || 'dept'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("PDF exported successfully");
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const isFinalized = activeWorkspace?.workflow_state === "FINALIZED";

  return (
    <WorkloadShell
      role="admin"
      title="Faculty Workload"
      subtitle="View individual faculty teaching hours and assignments"
      actions={
        <Button 
          size="sm" 
          onClick={handleExportPdf}
          disabled={!isFinalized || isExporting}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Download className="size-4" />
          {isExporting ? "Generating..." : "Export PDF"}
        </Button>
      }
    >
      <div className="space-y-6">
        {!isFinalized && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex gap-3 text-sm">
            <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Workspace Not Finalized</p>
              <p className="text-amber-700/80">
                Workload is generated only from <b>Finalized</b> allocations. Go to Subject Allocation and click Finalize to lock allocations and generate workload here.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#002147]" />
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Workload Summary
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Faculty Name</th>
                  <th className="px-6 py-3 text-center">Theory (h)</th>
                  <th className="px-6 py-3 text-center">Practical (h)</th>
                  <th className="px-6 py-3 text-center">Total (h)</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading workload data...</td>
                  </tr>
                ) : workloads.length > 0 ? (
                  workloads.map((row) => (
                    <tr key={row.faculty_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{row.faculty_name}</p>
                        {row.designation && <p className="text-xs text-slate-500">{row.designation}</p>}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-700">{row.total_theory_hours}</td>
                      <td className="px-6 py-4 text-center font-mono text-slate-700">{row.total_practical_hours}</td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-slate-900">{row.total_teaching_hours}</td>
                      <td className="px-6 py-4 text-center">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedFaculty(row)}
                          disabled={!row.assignments || row.assignments.length === 0}
                          className="text-xs"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <AlertCircle className="size-6 text-slate-400" />
                        </div>
                        <p className="font-medium">No finalized workload data.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedFaculty} onOpenChange={(o) => !o && setSelectedFaculty(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-slate-50">
          {selectedFaculty && (
            <>
              <div className="bg-[#002147] p-6 text-white flex justify-between items-center">
                <div>
                  <DialogTitle className="text-xl font-bold">{selectedFaculty.faculty_name}</DialogTitle>
                  <p className="text-sm text-blue-200 mt-1">{selectedFaculty.designation}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-200">Total Workload</p>
                  <p className="text-2xl font-black">{selectedFaculty.total_teaching_hours} <span className="text-sm font-normal">hrs</span></p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                      <tr>
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3 text-center">Class/Section</th>
                        <th className="px-5 py-3 text-center">Role</th>
                        <th className="px-5 py-3 text-center">Hours (T/P)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedFaculty.assignments?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3">
                            <p className="font-bold text-slate-900">{item.subject_code}</p>
                            <p className="text-xs text-slate-500">{item.subject_name}</p>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                              <Layers className="size-3" /> {item.section}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center text-xs font-bold text-slate-600">{item.role}</td>
                          <td className="px-5 py-3 text-center font-mono">
                            {item.theory_hours} / {item.practical_hours}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
