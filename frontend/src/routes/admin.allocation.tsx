import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { WorkloadShell } from "@/components/WorkloadShell";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle, SlidersHorizontal, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { academicApi } from "@/api/academicApi";
import { apiClient } from "@/api/client";

export const Route = createFileRoute("/admin/allocation")({
  component: AdminAllocationPage,
});

function AdminAllocationPage() {
  const { activeWorkspace } = useWorkspace();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [sectionForms, setSectionForms] = useState<any[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const isFinalized = activeWorkspace?.workflow_state === "FINALIZED";
  const sections = activeWorkspace?.sections || [];

  const fetchAllocations = useCallback(() => {
    if (!activeWorkspace) return;
    apiClient
      .get("/allocations", { params: { workspace_id: activeWorkspace.workspace_id } })
      .then((r) => setAllocations(Array.isArray(r.data) ? r.data : []))
      .catch(console.error);
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) return;
    academicApi.getSubjects(activeWorkspace.workspace_id).then(setSubjects).catch(console.error);
    fetchAllocations();
    apiClient
      .get("/faculty", { params: { department_id: activeWorkspace.department_id } })
      .then((r) => setFacultyList(Array.isArray(r.data) ? r.data : []))
      .catch(console.error);
  }, [activeWorkspace]);

  // Compute per-subject allocation status
  const subjectRows = subjects.map((sub) => {
    const subAllocs = allocations.filter((a) => a.subject_id === sub.id);
    const allocatedCount = subAllocs.filter(
      (a) => a.status === "ALLOCATED" || a.status === "FINALIZED"
    ).length;
    let status = "UNALLOCATED";
    if (subAllocs.some((a) => a.status === "FINALIZED")) status = "FINALIZED";
    else if (allocatedCount === sections.length && sections.length > 0) status = "ALLOCATED";
    else if (allocatedCount > 0) status = "PARTIALLY ALLOCATED";
    return { ...sub, allocatedSections: allocatedCount, totalSections: sections.length, status };
  });

  const openAllocationModal = (sub: any) => {
    setSelectedSubject(sub);
    const forms = sections.map((sec: any) => {
      const existing = allocations.find(
        (a) => a.subject_id === sub.id && a.section_id === sec.id
      );
      const mainComp = existing?.components?.find((c: any) => c.role === "Incharge-1");
      const asstComp = existing?.components?.find((c: any) => c.role === "Incharge-2");
      return {
        section_id: sec.id,
        section_name: sec.name,
        mainFacultyId: mainComp?.faculty_id ? String(mainComp.faculty_id) : "",
        asstFacultyId: asstComp?.faculty_id ? String(asstComp.faculty_id) : "",
        theoryHours: mainComp?.theory_hours ?? sub.theory_hours,
        practicalHours: (mainComp?.practical_hours ?? 0) + (asstComp?.practical_hours ?? 0) || sub.practical_hours,
        allocationSummary: existing
          ? `${(existing.components || []).map((c: any) => `${c.faculty_name} (${c.role})`).join(", ")}`
          : null,
        status: existing?.status || "UNALLOCATED",
      };
    });
    setSectionForms(forms);
  };

  const handleSaveSection = async (idx: number) => {
    const form = sectionForms[idx];
    if (!form.mainFacultyId) {
      toast.error("Main faculty is required");
      return;
    }
    try {
      const components: any[] = [];
      const hasAsst = !!form.asstFacultyId;
      components.push({
        faculty_id: Number(form.mainFacultyId),
        role: "Incharge-1",
        theory_hours: Number(form.theoryHours),
        practical_hours: hasAsst ? 0 : Number(form.practicalHours),
      });

      if (hasAsst) {
        components.push({
          faculty_id: Number(form.asstFacultyId),
          role: "Incharge-2",
          theory_hours: 0,
          practical_hours: Number(form.practicalHours),
        });
      }

      // Use the actual POST body format the backend expects
      await apiClient.post(
        `/allocations?workspace_id=${activeWorkspace!.workspace_id}&section_id=${form.section_id}&subject_id=${selectedSubject.id}`,
        components
      );

      toast.success(`Saved allocation for Section ${form.section_name}`);
      fetchAllocations();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save allocation");
    }
  };

  const handleFinalize = async () => {
    try {
      await apiClient.post(`/workload/finalize/department?workspace_id=${activeWorkspace!.workspace_id}`);
      toast.success("Allocation Finalized! Workspace is now locked.");
      fetchAllocations();
      setIsFinalizing(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "Failed to finalize");
    }
  };

  const unallocated = subjectRows.filter((s) => s.status === "UNALLOCATED").length;
  const allocated = subjectRows.filter(
    (s) => s.status === "ALLOCATED" || s.status === "FINALIZED"
  ).length;
  const partial = subjectRows.filter((s) => s.status === "PARTIALLY ALLOCATED").length;

  return (
    <WorkloadShell
      role="admin"
      title="Subject Allocation"
      subtitle="Assign faculty, roles, and hours for the selected academic context"
      actions={
        <div className="flex items-center gap-2">
          {isFinalized ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg">
              <Lock className="size-3.5" /> Finalized
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsFinalizing(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <CheckCircle2 className="size-4" /> Finalize Allocation
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Unallocated", val: unallocated, color: "text-slate-700 bg-slate-50 border-slate-200" },
            { label: "Partially Allocated", val: partial, color: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: "Allocated", val: allocated, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
            { label: "Finalized", val: isFinalized ? subjects.length : 0, color: "text-purple-700 bg-purple-50 border-purple-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 shadow-sm ${s.color}`}>
              <p className="text-xs font-semibold opacity-70 mb-1">{s.label}</p>
              <p className="text-2xl font-black">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Subjects table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-[#002147]" />
            <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Subject Offerings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3 text-center">Sections</th>
                  <th className="px-6 py-3 text-center">T / P Hours</th>
                  <th className="px-6 py-3 text-center">Allocation Status</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{row.course_code}</p>
                      <p className="text-xs text-slate-500">{row.course_name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${row.category === "CORE" ? "bg-indigo-100 text-indigo-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-700">
                      {row.totalSections > 0 ? sections.map((s: any) => s.name).join(", ") : "—"}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-700">
                      {row.theory_hours} / {row.practical_hours}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        row.status === "FINALIZED" ? "bg-purple-100 text-purple-700" :
                        row.status === "ALLOCATED" ? "bg-emerald-100 text-emerald-700" :
                        row.status === "PARTIALLY ALLOCATED" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {(row.status === "ALLOCATED" || row.status === "FINALIZED")
                          ? <CheckCircle2 className="size-3" />
                          : <AlertCircle className="size-3" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => openAllocationModal(row)}
                        disabled={isFinalized}
                        className={isFinalized ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#002147] hover:bg-[#001a38] text-white"}
                      >
                        {isFinalized ? "Locked" : "Allocate"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {subjectRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                      No subjects found for this workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Allocation Form Modal */}
      <Dialog open={!!selectedSubject} onOpenChange={(o) => !o && setSelectedSubject(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-slate-50">
          {selectedSubject && (
            <>
              <div className="bg-[#002147] p-6 text-white flex justify-between items-center">
                <div>
                  <DialogTitle className="text-xl font-bold">Allocate Subject Offering</DialogTitle>
                  <p className="text-sm text-blue-200 mt-1">
                    {selectedSubject.course_code} — {selectedSubject.course_name}
                  </p>
                </div>
                <div className="text-right text-sm text-blue-200 font-mono">
                  <p>Theory: {selectedSubject.theory_hours}h</p>
                  <p>Practical: {selectedSubject.practical_hours}h</p>
                </div>
              </div>

              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
                {sectionForms.map((form, idx) => (
                  <div key={form.section_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                      <h4 className="font-bold text-slate-800 text-base">
                        Class / Section: <span className="text-[#002147]">MCA GEN AI {form.section_name}</span>
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection(idx)}
                        disabled={isFinalized}
                        className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                      >
                        <Save className="size-4" /> Save Allocation
                      </Button>
                    </div>

                    {/* Allocation Summary */}
                    {form.allocationSummary && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                        <span className="font-bold text-blue-700">Current: </span>
                        <span className="text-blue-600">{form.allocationSummary}</span>
                        <span className={`ml-3 px-2 py-0.5 rounded font-bold ${form.status === "ALLOCATED" || form.status === "FINALIZED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {form.status}
                        </span>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Main Faculty</label>
                          <select
                            className="w-full border border-slate-300 rounded-lg text-sm p-2.5 bg-white focus:ring-2 focus:ring-blue-200"
                            value={form.mainFacultyId}
                            disabled={isFinalized}
                            onChange={(e) => {
                              const nf = [...sectionForms];
                              nf[idx].mainFacultyId = e.target.value;
                              setSectionForms(nf);
                            }}
                          >
                            <option value="">— Select Main Faculty —</option>
                            {facultyList.map((f: any) => (
                              <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Assistant / IN-2 (Optional)</label>
                          <select
                            className="w-full border border-slate-300 rounded-lg text-sm p-2.5 bg-white focus:ring-2 focus:ring-blue-200"
                            value={form.asstFacultyId}
                            disabled={isFinalized}
                            onChange={(e) => {
                              const nf = [...sectionForms];
                              nf[idx].asstFacultyId = e.target.value;
                              setSectionForms(nf);
                            }}
                          >
                            <option value="">— None —</option>
                            {facultyList.map((f: any) => (
                              <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-l border-slate-100 pl-6">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Theory Hours</label>
                          <Input
                            type="number"
                            value={form.theoryHours}
                            disabled={isFinalized}
                            onChange={(e) => {
                              const nf = [...sectionForms];
                              nf[idx].theoryHours = e.target.value;
                              setSectionForms(nf);
                            }}
                            className="mt-0"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Required: {selectedSubject.theory_hours}h</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Practical Hours</label>
                          <Input
                            type="number"
                            value={form.practicalHours}
                            disabled={isFinalized}
                            onChange={(e) => {
                              const nf = [...sectionForms];
                              nf[idx].practicalHours = e.target.value;
                              setSectionForms(nf);
                            }}
                            className="mt-0"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Required: {selectedSubject.practical_hours}h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Finalization Confirmation */}
      <Dialog open={isFinalizing} onOpenChange={setIsFinalizing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Finalize Allocation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm">
              <p className="font-bold text-amber-800 mb-2">⚠️ This action cannot be undone</p>
              <p className="text-amber-700">
                Finalizing will lock all allocations. Workload and Class-Wise Matrix will be generated from the finalized data.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Subjects to Finalize:</span>
                <span className="font-bold">{subjectRows.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Sections:</span>
                <span className="font-bold">{sections.length} ({sections.map((s: any) => s.name).join(", ")})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Allocated:</span>
                <span className="font-bold text-emerald-700">{allocated} / {subjectRows.length}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setIsFinalizing(false)}>Cancel</Button>
              <Button onClick={handleFinalize} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Confirm & Finalize
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
