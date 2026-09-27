import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { Search, CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { preferenceApi } from "@/api/preferenceApi";
import { apiClient } from "@/api/client";

export const Route = createFileRoute("/admin/preferences")({
  component: AdminPreferencesReviewPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SUBMITTED:     { bg: "bg-blue-100 text-blue-700",    icon: <CheckCircle2 className="size-3.5" />,  text: "Submitted" },
    NOT_SUBMITTED: { bg: "bg-slate-100 text-slate-500",   icon: <AlertCircle className="size-3.5" />,   text: "Not Submitted" },
    APPROVED:      { bg: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="size-3.5" />, text: "Approved" },
    PENDING:       { bg: "bg-amber-100 text-amber-700",  icon: <Clock className="size-3.5" />,          text: "Pending" },
    DENIED:        { bg: "bg-red-100 text-red-700",       icon: <XCircle className="size-3.5" />,       text: "Denied" },
  };
  const cfg = map[status] || map["PENDING"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg}`}>
      {cfg.icon} {cfg.text}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
      category === "CORE" ? "bg-indigo-100 text-indigo-700" : "bg-fuchsia-100 text-fuchsia-700"
    }`}>
      {category}
    </span>
  );
}

function AdminPreferencesReviewPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [allFaculty, setAllFaculty] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const isFinalized = activeWorkspace?.workflow_state === "FINALIZED";

  const fetchData = () => {
    if (!activeWorkspace) return;
    preferenceApi.getAllPreferences(activeWorkspace.workspace_id)
      .then(setSubmissions)
      .catch(console.error);
    apiClient.get("/faculty", { params: { department_id: activeWorkspace.department_id } })
      .then((r) => setAllFaculty(r.data))
      .catch(console.error);
  };

  useEffect(() => { fetchData(); }, [activeWorkspace]);

  // Build combined rows: submitted faculty + not-submitted faculty
  const rows = allFaculty.map((fac) => {
    const sub = submissions.find((s) => s.faculty_name === fac.name || s.faculty_id === fac.id);
    return {
      faculty_id: fac.id,
      faculty_name: fac.name,
      designation: fac.designation,
      submission: sub || null,
      submission_status: sub ? "SUBMITTED" : "NOT_SUBMITTED",
      review_status: sub?.review_status || "-",
      num_prefs: sub ? sub.items.length : 0,
    };
  });

  const filtered = rows.filter((r) => {
    const matchSearch = r.faculty_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SUBMITTED" && r.submission_status === "SUBMITTED") ||
      (statusFilter === "NOT_SUBMITTED" && r.submission_status === "NOT_SUBMITTED") ||
      (statusFilter === "APPROVED" && r.review_status === "APPROVED") ||
      (statusFilter === "PENDING" && r.review_status === "PENDING");
    return matchSearch && matchStatus;
  });

  const handleReview = async (submissionId: number, review_status: string) => {
    if (isFinalized) {
      toast.error("Cannot update review: workspace is finalized.");
      return;
    }
    setIsUpdating(true);
    try {
      await preferenceApi.reviewSubmission(submissionId, review_status);
      toast.success(`Marked as ${review_status}`);
      fetchData();
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission((prev: any) => prev ? { ...prev, review_status } : prev);
      }
    } catch {
      toast.error("Failed to update review");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <WorkloadShell
      role="admin"
      title="Faculty Preferences"
      subtitle="View and review faculty submitted preferences"
    >
      <div className="space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Faculty", val: allFaculty.length, color: "text-slate-800" },
            { label: "Submitted", val: submissions.length, color: "text-blue-700" },
            { label: "Not Submitted", val: allFaculty.length - submissions.length, color: "text-amber-600" },
            { label: "Approved", val: submissions.filter(s => s.review_status === "APPROVED").length, color: "text-emerald-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search faculty name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="NOT_SUBMITTED">Not Submitted</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Faculty Name</th>
                  <th className="px-6 py-3 text-center">Submission Status</th>
                  <th className="px-6 py-3 text-center"># Preferences</th>
                  <th className="px-6 py-3 text-center">Review Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((row) => (
                    <tr key={row.faculty_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{row.faculty_name}</p>
                        {row.designation && (
                          <p className="text-[11px] text-slate-500">{row.designation}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.submission_status} />
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-700 font-medium">
                        {row.num_prefs > 0 ? row.num_prefs : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.submission_status === "SUBMITTED" ? (
                          <StatusBadge status={row.review_status} />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.submission ? (
                          <Button
                            size="sm"
                            onClick={() => setSelectedSubmission(row.submission)}
                            className="bg-[#002147] hover:bg-[#001a38] text-white text-xs"
                          >
                            Review
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled className="text-xs">
                            Review
                          </Button>
                        )}
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
                        <p className="font-medium">No faculty preferences found.</p>
                        <p className="text-xs">Preference submissions will appear here once faculty submit them.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review Modal — submission-level review */}
      <Dialog open={!!selectedSubmission} onOpenChange={(o) => !o && setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-50">
          {selectedSubmission && (
            <>
              {/* Modal header */}
              <div className="bg-[#002147] p-6 text-white flex items-start justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {selectedSubmission.faculty_name} — Submitted Preferences
                  </DialogTitle>
                  <p className="text-sm text-blue-200 mt-1">
                    Submitted on{" "}
                    {selectedSubmission.submitted_at
                      ? new Date(selectedSubmission.submitted_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Unknown"}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={selectedSubmission.review_status || "PENDING"} />
                </div>
              </div>

              {/* Preference items table */}
              <div className="p-6">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-6">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                      <tr>
                        <th className="px-5 py-3 text-center w-12">Rank</th>
                        <th className="px-5 py-3">Subject Code</th>
                        <th className="px-5 py-3">Subject Name</th>
                        <th className="px-5 py-3 text-center">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...(selectedSubmission.items || [])].sort((a: any, b: any) => a.rank - b.rank).map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-center font-bold text-slate-800">{item.rank}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-blue-700">{item.subject_code}</td>
                          <td className="px-5 py-3 font-medium text-slate-800">{item.subject_name}</td>
                          <td className="px-5 py-3 text-center">
                            <CategoryBadge category={item.category || "CORE"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Decision — submission-level */}
                {!isFinalized && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Decision</p>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleReview(selectedSubmission.id, "APPROVED")}
                        disabled={isUpdating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReview(selectedSubmission.id, "PENDING")}
                        disabled={isUpdating}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                      >
                        Keep Pending
                      </Button>
                      <Button
                        onClick={() => handleReview(selectedSubmission.id, "DENIED")}
                        disabled={isUpdating}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        Deny
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedSubmission(null)}
                        className="ml-auto"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
                {isFinalized && (
                  <div className="flex items-center justify-end">
                    <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
