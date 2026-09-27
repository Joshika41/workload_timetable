import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WorkloadShell } from "@/components/WorkloadShell";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AlertCircle, Table2, Layers, CheckCircle2 } from "lucide-react";
import { workloadApi } from "@/api/workloadApi";

export const Route = createFileRoute("/admin/classmatrix")({
  component: AdminClassMatrixPage,
});

function AdminClassMatrixPage() {
  const { activeWorkspace } = useWorkspace();
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    workloadApi
      .getClassMatrix(activeWorkspace.workspace_id)
      .then((data) => {
        setMatrixData(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [activeWorkspace]);

  const isFinalized = activeWorkspace?.workflow_state === "FINALIZED";
  const sections = activeWorkspace?.sections || [];

  return (
    <WorkloadShell
      role="admin"
      title="Class-Wise Matrix"
      subtitle="View section-level subject allocations and faculty assignments"
    >
      <div className="space-y-6">
        {!isFinalized && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex gap-3 text-sm">
            <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Workspace Not Finalized</p>
              <p className="text-amber-700/80">
                The Class-Wise Matrix is generated from <b>Finalized</b> allocations. Go to Subject Allocation and click Finalize to lock allocations and view the matrix here.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <Table2 className="size-4 text-[#002147]" />
            <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {activeWorkspace?.programme_name} - Sections {sections.map((s) => s.name).join(", ")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 border-r border-slate-100">Class/Section</th>
                  <th className="px-6 py-3 border-r border-slate-100">Subject</th>
                  <th className="px-6 py-3 text-center border-r border-slate-100">T/P Hours</th>
                  <th className="px-6 py-3 border-r border-slate-100">Main Faculty</th>
                  <th className="px-6 py-3 border-r border-slate-100">Assistant Faculty</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      Loading matrix data...
                    </td>
                  </tr>
                ) : matrixData.length > 0 ? (
                  matrixData.map((row, idx) => {
                    const mainStr = row.main_faculty.map((f: any) => `${f.name} (${f.theory_hours}/${f.practical_hours})`).join(", ") || "—";
                    const asstStr = row.assistant_faculty.map((f: any) => `${f.name} (${f.theory_hours}/${f.practical_hours})`).join(", ") || "—";
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-100 font-bold text-[#002147]">
                          <div className="flex items-center gap-1.5">
                            <Layers className="size-3.5" />
                            {row.section_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100">
                          <p className="font-bold text-slate-900">{row.subject_code}</p>
                          <p className="text-xs text-slate-500">{row.subject_name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${row.category === "CORE" ? "bg-indigo-100 text-indigo-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>
                            {row.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center font-mono text-slate-700">
                          {row.theory} / {row.practical}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 font-medium text-slate-800">
                          {mainStr}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-slate-600">
                          {asstStr}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {row.status === "FINALIZED" ? (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              <CheckCircle2 className="size-3" />
                              Finalized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              <AlertCircle className="size-3" />
                              {row.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <AlertCircle className="size-6 text-slate-400" />
                        </div>
                        <p className="font-medium">No matrix data available.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </WorkloadShell>
  );
}
