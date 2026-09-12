import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ClipboardList,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/admin/preferences")({
  component: PreferenceReview,
});

interface PreferenceRow {
  id: string;
  faculty_id: string;
  faculty_name: string;
  subject_code: string;
  course_title?: string;
  status: string;
  submitted_at?: string;
  has_conflict?: boolean;
}

function PreferenceReview() {
  const { programType, setProgramType, semesterType, setSemesterType } =
    useWorkspace();

  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/preferences", {
        params: { program_type: programType, semester_type: semesterType },
      });
      setPreferences(
        (res.data || []).map((item: any) => ({
          id: item.id || `${item.faculty_id}_${item.subject_code}`,
          faculty_id: item.faculty_id,
          faculty_name: item.faculty_name || item.faculty_id,
          subject_code: item.subject_code,
          course_title: item.course_title || "",
          status: item.status || "PENDING",
          submitted_at: item.submitted_at,
        }))
      );
    } catch (err: any) {
      toast.error(
        err.message || "Failed to fetch preferences."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [programType, semesterType]);

  // Conflict detection: subject_code selected by multiple faculty
  const conflictSubjects = useMemo(() => {
    const counts: Record<string, number> = {};
    preferences.forEach((p) => {
      counts[p.subject_code] = (counts[p.subject_code] || 0) + 1;
    });
    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([code]) => code)
    );
  }, [preferences]);

  const handleStatusChange = async (
    prefId: string,
    newStatus: string
  ) => {
    setUpdatingId(prefId);
    try {
      await api.put(`/api/admin/preferences/${prefId}/status`, {
        status: newStatus,
      });
      setPreferences((prev) =>
        prev.map((p) => (p.id === prefId ? { ...p, status: newStatus } : p))
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(
        err.message || "Failed to update status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm">
            <CheckCircle2 className="size-3" /> Approved
          </span>
        );
      case "DENIED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700 shadow-sm">
            <XCircle className="size-3" /> Denied
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700 shadow-sm">
            <Clock className="size-3" /> Pending
          </span>
        );
    }
  };

  return (
    <PortalShell
      role="admin"
      title="Preference Review"
      subtitle="Review faculty subject carts, resolve conflicts, and manage approvals"
      nav={adminNav}
    >
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <ToggleGroup
              type="single"
              value={programType}
              onValueChange={(v) => v && setProgramType(v)}
              className="bg-muted p-1 rounded-xl"
            >
              <ToggleGroupItem
                value="UG"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >
                UG
              </ToggleGroupItem>
              <ToggleGroupItem
                value="PG"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >
                PG
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={semesterType}
              onValueChange={(v) => v && setSemesterType(v)}
              className="bg-muted p-1 rounded-xl"
            >
              <ToggleGroupItem
                value="Odd"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >
                Odd
              </ToggleGroupItem>
              <ToggleGroupItem
                value="Even"
                className="rounded-lg px-4 font-semibold text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >
                Even
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-3">
            {conflictSubjects.size > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 border border-red-200 px-3 py-1 text-xs font-bold text-red-700 animate-pulse">
                <ShieldAlert className="size-3.5" /> {conflictSubjects.size}{" "}
                Conflict{conflictSubjects.size > 1 ? "s" : ""}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPreferences}
              disabled={loading}
              className="gap-1.5 rounded-xl"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </Button>
          </div>
        </div>

        {/* Preference Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-wider">
                    Faculty
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider">
                    Subject Code
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-16 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto size-8 animate-spin text-primary opacity-60 mb-3" />
                      <p className="font-medium">Loading preference data...</p>
                    </td>
                  </tr>
                ) : preferences.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center opacity-60">
                        <ClipboardList className="size-12 mb-3 text-muted-foreground" />
                        <p className="font-semibold text-lg">
                          No Preferences Submitted
                        </p>
                        <p className="text-sm mt-1">
                          Faculty must log in and submit their subject carts
                          first.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  preferences.map((pref) => {
                    const hasConflict = conflictSubjects.has(
                      pref.subject_code
                    );
                    return (
                      <tr
                        key={pref.id}
                        className={`group hover:bg-muted/30 transition-colors ${hasConflict ? "bg-red-50/40" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                              {pref.faculty_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-foreground">
                              {pref.faculty_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 inline-block w-fit shadow-sm">
                              {pref.subject_code}
                            </span>
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 w-fit shadow-sm animate-pulse">
                                <ShieldAlert className="size-3" /> ⚠️ Conflict
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(pref.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                updatingId === pref.id ||
                                pref.status === "APPROVED"
                              }
                              onClick={() =>
                                handleStatusChange(pref.id, "APPROVED")
                              }
                              className="rounded-lg text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40"
                            >
                              <CheckCircle2 className="size-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                updatingId === pref.id ||
                                pref.status === "PENDING"
                              }
                              onClick={() =>
                                handleStatusChange(pref.id, "PENDING")
                              }
                              className="rounded-lg text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-40"
                            >
                              <Clock className="size-3" /> Pending
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                updatingId === pref.id ||
                                pref.status === "DENIED"
                              }
                              onClick={() =>
                                handleStatusChange(pref.id, "DENIED")
                              }
                              className="rounded-lg text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 disabled:opacity-40"
                            >
                              <XCircle className="size-3" /> Deny
                            </Button>
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

        {/* Conflict Summary */}
        {conflictSubjects.size > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="size-5 text-red-600" />
              <h3 className="font-bold text-red-800">
                Conflict Summary
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(conflictSubjects).map((code) => {
                const conflicting = preferences.filter(
                  (p) => p.subject_code === code
                );
                return (
                  <div
                    key={code}
                    className="rounded-xl border border-red-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-mono text-sm font-bold text-red-700 mb-2">
                      {code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Selected by:{" "}
                      <span className="font-semibold text-foreground">
                        {conflicting
                          .map((c) => c.faculty_name)
                          .join(", ")}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
