import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  ScrollText,
  RefreshCw,
  Search,
  Clock,
  User,
  ArrowRight,
  Loader2,
  History,
} from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  component: AuditTrail,
});

interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  user_email?: string;
  entity_type?: string;
  entity_id?: string;
  previous_value?: string;
  new_value?: string;
  details?: string;
}

function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/audit-logs");
      setLogs(res.data || []);
    } catch (err: any) {
      // Endpoint might not exist yet; show graceful fallback
      console.error("Failed to fetch audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term) ||
      log.entity_type?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term)
    );
  });

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const getActionColor = (action: string) => {
    const a = action?.toUpperCase() || "";
    if (a.includes("DELETE") || a.includes("WIPE"))
      return "text-red-700 bg-red-100 border-red-200";
    if (a.includes("CREATE") || a.includes("UPLOAD"))
      return "text-emerald-700 bg-emerald-100 border-emerald-200";
    if (a.includes("LOCK") || a.includes("PUBLISH"))
      return "text-indigo-700 bg-indigo-100 border-indigo-200";
    if (a.includes("UPDATE") || a.includes("ASSIGN"))
      return "text-amber-700 bg-amber-100 border-amber-200";
    return "text-slate-700 bg-slate-100 border-slate-200";
  };

  return (
    <PortalShell
      role="admin"
      title="Audit Trail"
      subtitle="Complete historical log of all system actions and allocation overrides"
      nav={adminNav}
    >
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, user, entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </Button>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-wider w-[18%]">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider w-[14%]">
                    Action
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider w-[16%]">
                    User
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider w-[12%]">
                    Entity
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider w-[18%]">
                    Previous Value
                  </th>
                  <th className="px-6 py-4 font-bold tracking-wider w-[4%]" />
                  <th className="px-6 py-4 font-bold tracking-wider w-[18%]">
                    New Value
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
                      <p className="font-medium">Loading audit trail...</p>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center opacity-60">
                        <History className="size-12 mb-3 text-muted-foreground" />
                        <p className="font-semibold text-lg">
                          {logs.length === 0
                            ? "No Audit Logs Yet"
                            : "No Matching Results"}
                        </p>
                        <p className="text-sm mt-1">
                          {logs.length === 0
                            ? "Actions will appear here as administrators and faculty interact with the system."
                            : "Try adjusting your search term."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr
                      key={log.id || idx}
                      className={`group hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "bg-muted/10" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3.5 shrink-0" />
                          <span className="font-mono">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getActionColor(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                            {log.user_email || "System"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                          {log.entity_type || "-"}
                          {log.entity_id ? ` #${log.entity_id}` : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-muted-foreground font-mono truncate block max-w-[160px]">
                          {log.previous_value || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {log.new_value && log.previous_value && (
                          <ArrowRight className="size-4 text-primary mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-foreground font-mono truncate block max-w-[160px]">
                          {log.new_value || log.details || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filteredLogs.length > 0 && (
            <div className="border-t border-border bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} total audit
              entries
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
