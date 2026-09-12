import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  FileDown,
  ShieldAlert,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Lock,
  Loader2,
  Calculator,
} from "lucide-react";
import api from "@/lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/admin/allocation")({
  component: AdminAllocation,
});

interface AllocationRow {
  id: string;
  faculty_id: string;
  faculty_name: string;
  subject_code: string;
  cohort_id: string;
  cohort_name: string;
  role_type: string;
  allocated_theory_hours: number;
  allocated_lab_hours: number;
  max_theory: number;
  max_lab: number;
  has_conflict: boolean;
  status: string;
}


function SkeletonRow() {
  return (
    <tr className="animate-pulse bg-white border-b border-slate-100">
      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
      <td className="p-3"><div className="h-6 bg-slate-200 rounded-full w-16"></div></td>
      <td className="p-3"><div className="h-8 bg-slate-200 rounded w-16"></div></td>
      <td className="p-3"><div className="h-8 bg-slate-200 rounded w-16"></div></td>
      <td className="p-3 text-center"><div className="h-4 bg-slate-200 rounded w-8 mx-auto"></div></td>
      <td className="p-3"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
    </tr>
  );
}

function AdminAllocation() {
  const {
    programType,
    setProgramType,
    semesterType,
    setSemesterType,
    activeDepartmentName,
    isAllocationLocked,
    setIsAllocationLocked,
  } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [modifiedRows, setModifiedRows] = useState<Set<string>>(new Set());

  // Wipe Slate dialog
  const [showWipe, setShowWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  // Lock & Publish dialog
  const [showLock, setShowLock] = useState(false);
  const [locking, setLocking] = useState(false);

  // Verification Sheet
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [unassignedItems, setUnassignedItems] = useState<any[]>([]);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/preferences", {
        params: { program_type: programType, semester_type: semesterType },
      });

      const data = (res.data || []).map((item: any) => ({
        id: item.id || `${item.faculty_id}_${item.subject_code}`,
        faculty_id: item.faculty_id,
        faculty_name: item.faculty_name || item.faculty_id,
        subject_code: item.subject_code,
        cohort_id: item.cohort_id || "",
        cohort_name: item.cohort_name || "",
        role_type: item.role_type || "Main",
        allocated_theory_hours: item.allocated_theory_hours || 0,
        allocated_lab_hours: item.allocated_lab_hours || 0,
        max_theory: item.max_theory || 4,
        max_lab: item.max_lab || 2,
        has_conflict: item.has_conflict || false,
        status: item.status || "PENDING",
      }));
      setAllocations(data);
      setModifiedRows(new Set());
    } catch (err: any) {
      toast.error(
        err.message || "Failed to fetch matrix data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [programType, semesterType]);

  const handleCellChange = (
    id: string,
    field: "allocated_theory_hours" | "allocated_lab_hours",
    value: string
  ) => {
    const numValue = Math.max(0, parseInt(value, 10) || 0);
    setAllocations((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: numValue } : row
      )
    );
    setModifiedRows((prev) => new Set(prev).add(id));
  };

  const handleRoleChange = (id: string, role: string) => {
    setAllocations((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, role_type: role } : row
      )
    );
    setModifiedRows((prev) => new Set(prev).add(id));
  };

  // Live math: faculty total hours
  const facultyTotals = useMemo(() => {
    const totals: Record<string, { theory: number; lab: number; total: number }> = {};
    allocations.forEach((row) => {
      if (!totals[row.faculty_id]) {
        totals[row.faculty_id] = { theory: 0, lab: 0, total: 0 };
      }
      const entry = totals[row.faculty_id]!;
      entry.theory += row.allocated_theory_hours;
      entry.lab += row.allocated_lab_hours;
      entry.total += row.allocated_theory_hours + row.allocated_lab_hours;
    });
    return totals;
  }, [allocations]);

  const handleSave = async () => {
    const changes = allocations.filter((row) => modifiedRows.has(row.id));
    if (changes.length === 0) return;

    setSaving(true);
    try {
      const cohortGroups: Record<string, any[]> = {};
      changes.forEach((row) => {
        const key = `${row.cohort_id}_${row.subject_code}`;
        if (!cohortGroups[key]) cohortGroups[key] = [];
        cohortGroups[key].push({
          faculty_id: row.faculty_id,
          role_type: row.role_type,
          theory_hours: row.allocated_theory_hours,
          lab_hours: row.allocated_lab_hours,
        });
      });

      for (const [key, allocs] of Object.entries(cohortGroups)) {
        const [cid, sc] = key.split("_");
        await api.post("/api/admin/allocations/assign", {
          cohort_id: cid,
          subject_code: sc,
          allocations: allocs,
        });
      }

      toast.success(
        `Successfully updated ${changes.length} assignment(s) and recorded Audit Logs.`
      );
      setModifiedRows(new Set());
    } catch (err: any) {
      toast.error(
        err.message || "Failed to assign workload."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleWipeSlate = async () => {
    setWiping(true);
    try {
      await api.post("/api/admin/allocations/wipe", {
        program_type: programType,
        semester_type: semesterType,
      });
      toast.success(
        "All allocations wiped! The matrix has been cleared."
      );
      setShowWipe(false);
      fetchMatrix();
    } catch (err: any) {
      toast.error(
        err.message || "Failed to wipe allocations."
      );
    } finally {
      setWiping(false);
    }
  };

  const handleLockPublish = async () => {
    setLocking(true);
    try {
      await api.post("/api/admin/allocations/lock", {
        program_type: programType,
        semester_type: semesterType,
      });
      setIsAllocationLocked(true);
      toast.success(
        "Workload locked & published! Email notifications sent to faculty."
      );
      setShowLock(false);
    } catch (err: any) {
      toast.error(
        err.message || "Failed to lock allocations."
      );
    } finally {
      setLocking(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifyOpen(true);
    setVerifyLoading(true);
    try {
      const res = await api.get("/api/admin/verify-allocations", {
        params: { program_type: programType, semester_type: semesterType },
      });
      setUnassignedItems(res.data.issues || []);
    } catch (err: any) {
      toast.error(
        err.message || "Failed to run verification sweep"
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleExportPDF = () => {
    try {
      const toastId = toast.loading("Generating PDF...");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // University Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("SRM Institute of Science and Technology", 148.5, 15, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Faculty Workload Allocation Matrix", 148.5, 22, { align: "center" });

      doc.setFontSize(10);
      doc.text(
        `Department: ${activeDepartmentName || "All"} | Program: ${programType} | Semester: ${semesterType}`,
        148.5,
        28,
        { align: "center" }
      );

      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(20, 31, 277, 31);

      // Table Data
      const tableData = allocations.map((row) => [
        row.faculty_name,
        row.subject_code,
        row.cohort_name || "Unassigned",
        row.role_type,
        row.allocated_theory_hours.toString(),
        row.allocated_lab_hours.toString(),
        (row.allocated_theory_hours + row.allocated_lab_hours).toString(),
        row.has_conflict ? "âš  CONFLICT" : "OK",
      ]);

      autoTable(doc, {
        startY: 35,
        head: [
          [
            "Faculty Name",
            "Subject Code",
            "Cohort",
            "Role",
            "Theory Hrs",
            "Lab Hrs",
            "Total Hrs",
            "Status",
          ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: {
          cellPadding: 3,
          lineColor: [200, 210, 230],
          lineWidth: 0.25,
        },
        columnStyles: {
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center", fontStyle: "bold" },
          7: { halign: "center" },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Generated: ${new Date().toLocaleString("en-IN")} | Page ${i} of ${pageCount}`,
          148.5,
          200,
          { align: "center" }
        );
      }

      doc.save(
        `Workload_Matrix_${activeDepartmentName || "All"}_${programType}_${semesterType}.pdf`
      );
      toast.success("PDF downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF export.");
    }
  };

  return (
    <PortalShell
      role="admin"
      title="Workload Allocation Matrix"
      subtitle="Granular workload distribution, conflict resolution & publishing"
      nav={adminNav}
    >
      <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Locked Banner */}
        {isAllocationLocked && (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <Lock className="size-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">
                Workload is Locked & Published
              </p>
              <p className="text-xs text-indigo-600/70">
                Faculty have been notified. Matrix is read-only.
              </p>
            </div>
          </div>
        )}

        {/* Top Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <ToggleGroup
              type="single"
              value={programType}
              onValueChange={(v) => v && setProgramType(v)}
              className="bg-muted p-1.5 rounded-xl"
            >
              <ToggleGroupItem
                value="UG"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md transition-all"
              >
                UG
              </ToggleGroupItem>
              <ToggleGroupItem
                value="PG"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md transition-all"
              >
                PG
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={semesterType}
              onValueChange={(v) => v && setSemesterType(v)}
              className="bg-muted p-1.5 rounded-xl"
            >
              <ToggleGroupItem
                value="Odd"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md transition-all"
              >
                Odd
              </ToggleGroupItem>
              <ToggleGroupItem
                value="Even"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md transition-all"
              >
                Even
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchMatrix}
              disabled={loading}
              title="Refresh Matrix"
              className="rounded-xl"
            >
              <RefreshCw
                className={`size-4 text-primary ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Wipe Slate */}
            <Button
              variant="outline"
              onClick={() => setShowWipe(true)}
              disabled={isAllocationLocked}
              className="gap-2 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 shadow-sm transition-all hover:-translate-y-0.5"
            >
              <Trash2 className="size-4" /> Wipe Slate
            </Button>

            {/* Verify */}
            <Button
              variant="outline"
              onClick={handleVerify}
              className="gap-2 rounded-xl text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 shadow-sm transition-all hover:-translate-y-0.5"
            >
              <ShieldAlert className="size-4" /> Verify
            </Button>

            {/* Export PDF */}
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="gap-2 rounded-xl shadow-sm transition-all hover:-translate-y-0.5"
            >
              <FileDown className="size-4" /> Export PDF
            </Button>

            {/* Lock & Publish */}
            <Button
              onClick={() => setShowLock(true)}
              disabled={isAllocationLocked}
              className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg transition-all hover:-translate-y-0.5"
            >
              <Lock className="size-4" /> Lock & Publish
            </Button>

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={
                modifiedRows.size === 0 || saving || isAllocationLocked
              }
              className="gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-lg transition-all hover:-translate-y-0.5"
            >
              <Save className="size-4" />{" "}
              {saving
                ? "Saving..."
                : `Commit Changes (${modifiedRows.size})`}
            </Button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex-1 flex flex-col min-h-[500px]">
          <div className="overflow-x-auto flex-1 relative">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4 font-bold tracking-wider">
                    Faculty
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider">
                    Subject
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider">
                    Cohort
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider">
                    Role
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider text-center">
                    Theory
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider text-center">
                    Lab
                  </th>
                  <th className="px-5 py-4 font-bold tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calculator className="size-3" /> Total
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto size-8 animate-spin text-primary opacity-60 mb-3" />
                      <p className="font-medium">
                        Loading allocation matrix...
                      </p>
                    </td>
                  </tr>
                ) : allocations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center opacity-60">
                        <AlertTriangle className="size-12 mb-3 text-muted-foreground" />
                        <p className="font-semibold text-lg">
                          No Faculty Preferences Submitted
                        </p>
                        <p className="text-sm mt-1">
                          Faculty must log in and submit their Carts before the
                          matrix generates.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  allocations.map((row) => {
                    const totalHrs =
                      row.allocated_theory_hours + row.allocated_lab_hours;
                    return (
                      <tr
                        key={row.id}
                        className={`group hover:bg-muted/30 transition-all duration-200 ${modifiedRows.has(row.id) ? "bg-indigo-50/40" : ""} ${row.has_conflict ? "bg-red-50/30" : ""}`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                              {row.faculty_name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block text-sm">
                                {row.faculty_name}
                              </span>
                              {facultyTotals[row.faculty_id] && (
                                <span className="text-[10px] text-muted-foreground">
                                  Faculty Total:{" "}
                                  <span className="font-bold">
                                    {facultyTotals[row.faculty_id]?.total ?? 0}h
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 inline-block w-fit shadow-sm">
                              {row.subject_code}
                            </span>
                            {row.has_conflict && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 w-fit shadow-sm animate-pulse">
                                <ShieldAlert className="size-3" /> âš ï¸ Conflict
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {row.cohort_name ? (
                            <span className="font-medium text-foreground text-sm">
                              {row.cohort_name}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Select
                            value={row.role_type}
                            onValueChange={(v) => handleRoleChange(row.id, v)}
                            disabled={isAllocationLocked}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Main">
                                Main Faculty
                              </SelectItem>
                              <SelectItem value="Assist">
                                Assist / Incharge 2
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            <Input
                              type="number"
                              min={0}
                              max={row.max_theory}
                              className={`w-16 h-8 font-mono text-center text-sm font-semibold rounded-lg transition-all ${modifiedRows.has(row.id) ? "border-primary/50 bg-primary/5" : "bg-background border-border"}`}
                              value={row.allocated_theory_hours.toString()}
                              onChange={(e) =>
                                handleCellChange(
                                  row.id,
                                  "allocated_theory_hours",
                                  e.target.value
                                )
                              }
                              disabled={isAllocationLocked}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            <Input
                              type="number"
                              min={0}
                              max={row.max_lab}
                              className={`w-16 h-8 font-mono text-center text-sm font-semibold rounded-lg transition-all ${modifiedRows.has(row.id) ? "border-primary/50 bg-primary/5" : "bg-background border-border"}`}
                              value={row.allocated_lab_hours.toString()}
                              onChange={(e) =>
                                handleCellChange(
                                  row.id,
                                  "allocated_lab_hours",
                                  e.target.value
                                )
                              }
                              disabled={isAllocationLocked}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            <span
                              className={`inline-flex items-center justify-center w-16 h-8 rounded-lg font-mono text-sm font-bold shadow-sm border ${totalHrs > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-muted text-muted-foreground border-border"}`}
                            >
                              {totalHrs}h
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Wipe Slate Confirmation */}
      <AlertDialog open={showWipe} onOpenChange={setShowWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" /> Wipe All Allocations?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear ALL allocation data for{" "}
              <strong>
                {programType} â€” {semesterType} Semester
              </strong>
              . Faculty will need to resubmit their preferences. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wiping}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipeSlate}
              disabled={wiping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {wiping ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              {wiping ? "Wiping..." : "Wipe Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock & Publish Confirmation */}
      <AlertDialog open={showLock} onOpenChange={setShowLock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-700 flex items-center gap-2">
              <Lock className="size-5" /> Lock & Publish Workload?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize the{" "}
              <strong>
                {programType} â€” {semesterType}
              </strong>{" "}
              workload matrix, lock it from further edits, and send email
              notifications to all assigned faculty members. Ensure all
              allocations are verified before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={locking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLockPublish}
              disabled={locking}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {locking ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Lock className="size-4 mr-2" />
              )}
              {locking ? "Publishing..." : "Lock & Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Slide-Over */}
      <Sheet open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 text-primary text-xl">
              <ShieldAlert className="size-6 text-amber-500" />
              Verification Sweep
            </SheetTitle>
            <SheetDescription>
              Identifying unassigned curriculum mapping and allocation gaps
              across the {programType} {semesterType} workspace.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {verifyLoading ? (
              <div className="flex items-center justify-center py-12 text-primary">
                <RefreshCw className="size-8 animate-spin opacity-50" />
              </div>
            ) : unassignedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-500">
                <div className="size-20 rounded-full bg-green-100 flex items-center justify-center mb-5 shadow-inner">
                  <CheckCircle2 className="size-10 text-green-600" />
                </div>
                <h3 className="font-bold text-xl text-foreground">
                  100% Verified
                </h3>
                <p className="text-sm text-muted-foreground mt-2 font-medium">
                  All cohorts and subjects are fully mapped and allocated.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
                  Unassigned Items ({unassignedItems.length})
                </h3>
                {unassignedItems.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                        {item.subject_code}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground bg-white px-2 py-0.5 rounded shadow-sm">
                        {item.cohort_name}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Missing{" "}
                      <span className="text-red-600 font-bold">
                        {item.missing_hours}
                      </span>{" "}
                      hours of {item.missing_type} allocation.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PortalShell>
  );
}

