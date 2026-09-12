import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Upload,
  Loader2,
  Sparkles,
  CalendarCog,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { useAuth } from "@/lib/auth";
import type { Faculty } from "@/lib/erp-data";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/admin/workload")({
  head: () => ({
    meta: [
      { title: "Workload Generation · Admin · SRM ERP" },
      {
        name: "description",
        content:
          "Upload syllabus and faculty data, configure theory, lab and incharge hours, then generate departmental workload matrices.",
      },
      { property: "og:title", content: "Workload Generation · Admin · SRM ERP" },
      {
        property: "og:description",
        content: "Configure faculty hour allocation and generate university workload matrices.",
      },
    ],
  }),
  component: WorkloadPage,
});

const UPLOADS = [
  { key: "syllabus", label: "Syllabus File", hint: "Course codes, credits, hour split" },
  { key: "faculty", label: "Faculty List", hint: "Names, IDs, designations" },
  { key: "rooms", label: "Classroom / Lab List", hint: "Capacity and lab equipment" },
  { key: "hours", label: "Total Hours Reference", hint: "Max hours by designation" },
] as const;

function total(f: any) {
  return (f.theoryHours ?? f.theory_hours ?? 0) + (f.labHours ?? f.lab_hours ?? 0) + (f.inchargeHours ?? f.incharge_hours ?? 0);
}

function UploadZone({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/50 px-4 py-6 text-center opacity-80 cursor-default">
      <FileSpreadsheet className="size-6 text-primary" />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
        <CheckCircle2 className="size-3.5" /> Data Synced from Cloud
      </span>
    </div>
  );
}

function WorkloadPage() {
  const { session, departmentLabs, fetchDepartments, toggleHasLabs } = useAuth();
  
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const activeDepartment = session?.department || "MCA";
  const hasLabs = departmentLabs[activeDepartment] ?? true;

  const [program, setProgram] = useState<"UG" | "PG">("PG");
  const [scope, setScope] = useState("current");
  const { data: fetchedFaculty, isLoading } = useQuery({
    queryKey: ["faculty-list"],
    queryFn: async () => {
      const res = await api.get<Faculty[]>("/api/admin/faculty-list");
      return res.data;
    },
  });

  const { data: adminPreferences } = useQuery({
    queryKey: ["admin-preferences"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/admin/preferences");
        return res.data;
      } catch (e) {
        return [];
      }
    },
  });

  const [rows, setRows] = useState<Faculty[]>([]);
  
  // Sync fetched data into local editable rows state
  useEffect(() => {
    if (fetchedFaculty && rows.length === 0) {
      setRows(fetchedFaculty);
    }
  }, [fetchedFaculty]);

  const [approved, setApproved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Faculty[] | null>(null);

  function update(id: string, patch: Partial<Faculty>) {
    setRows((prev) => prev.map((r: any) => ((r.id || r.faculty_id) === id ? { ...r, ...patch } : r)));
  }

  async function generate(all = false) {
    setGenerating(true);
    setProgress(8);
    setResults(null);
    
    const timer = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + 11));
    }, 180);

    try {
      if (all) {
        const res = await api.post("/api/generate/timetables", {});
        const taskId = res.data.task_id;
        
        if (!taskId) {
            throw new Error("No task ID returned from background processor");
        }
        
        let status = "PENDING";
        let finalResult = null;
        
        while (status === "PENDING" || status === "PROCESSING") {
            await new Promise(r => setTimeout(r, 3000));
            const pollRes = await api.get(`/api/generate/status/${taskId}`);
            status = pollRes.data.status;
            finalResult = pollRes.data.result;
            if (status === "PROCESSING") setProgress(p => p >= 90 ? p : p + 2);
        }
        
        window.clearInterval(timer);
        setProgress(100);
        
        if (status === "FAILED") {
            throw new Error(finalResult?.detail || "Solver failed to generate timetable");
        }
        
        toast.success("Timetables generated successfully!", {
          description: `Backend Engine Status: ${finalResult?.status || 'Success'}`,
        });
      } else {
        const payload = rows.map(r => ({
          faculty_id: r.id || r.faculty_id,
          department: r.department,
          theory_hours: r.theoryHours,
          lab_hours: r.labHours,
          incharge_hours: r.inchargeHours,
          max_hours_limit: r.maxHours
        }));

        const res = await api.post("/api/workload/allocate", payload);
        
        window.clearInterval(timer);
        setProgress(100);
        
        if (res.data.workload) {
          const newResults = res.data.workload.map((w: any) => ({
            id: w.faculty_id,
            name: rows.find(r => (r.id || r.faculty_id) === w.faculty_id)?.name || w.faculty_id,
            department: w.department,
            theoryHours: w.theory_hours,
            labHours: w.lab_hours,
            inchargeHours: w.incharge_hours,
            maxHours: w.max_hours_limit
          }));
          setResults(newResults);
        } else {
          setResults(rows); 
        }
        
        toast.success("Workload matrix generated", {
          description: `Backend Engine Status: ${res.data.status || 'Success'}`,
        });
      }
    } catch (err: any) {
      window.clearInterval(timer);
      const detail = err.message || err.message;
      if (err.response?.status === 400 && detail) {
        toast.error("Schedule mathematically impossible", { description: detail });
      } else {
        toast.error("Generation failed", { description: detail });
      }
    } finally {
      setGenerating(false);
    }
  }

  const handleExport = async () => {
    try {
      const response = await api.get('/api/export/timetable', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'university_timetable.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error("Export failed. Timetables may not be generated yet.");
    }
  };

  return (
    <PortalShell
      role="admin"
      title="Workload History & Generation"
      subtitle={session?.department ?? "Department workspace"}
      nav={adminNav}
    >
      <div className="space-y-6">
        {/* Step 1 — uploads */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step 1</p>
              <h2 className="text-lg font-semibold text-foreground">Data Ingestion</h2>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <span
                  className={
                    program === "UG" ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"
                  }
                >
                  Undergraduate
                </span>
                <Switch
                  checked={program === "PG"}
                  onCheckedChange={(v) => setProgram(v ? "PG" : "UG")}
                  aria-label="Toggle undergraduate or postgraduate"
                />
                <span
                  className={
                    program === "PG" ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"
                  }
                >
                  Postgraduate
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Syllabus scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole">Whole Syllabus</SelectItem>
                    <SelectItem value="current">Current Sem Syllabus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {UPLOADS.map((u) => (
              <UploadZone key={u.key} label={u.label} hint={u.hint} />
            ))}
          </div>
        </section>

        {/* Step 2 — faculty configuration */}
        <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step 2</p>
            <h2 className="text-lg font-semibold text-foreground">Faculty Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Allocate theory, lab and incharge hours against each faculty member&apos;s maximum capacity.
            </p>
          </div>
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-left">
                  {[
                    "Faculty Name",
                    "Department",
                    "Faculty ID",
                    "Theory Hours",
                    "Lab Hours",
                    "Incharge Hours",
                    "Total Limit",
                    "Allocated",
                    "Constraints"
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                      Loading faculty from database...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No faculty found. Please seed the database.
                    </td>
                  </tr>
                ) : rows.map((f: any) => {
                  const fid = f.id || f.faculty_id;
                  const used = total({ ...f, theoryHours: f.theoryHours ?? f.theory_hours, labHours: f.labHours ?? f.lab_hours, inchargeHours: f.inchargeHours ?? f.incharge_hours });
                  const maxH = f.maxHours ?? f.max_hours_limit;
                  const over = used > maxH;
                  
                  const prefs = adminPreferences?.filter((p: any) => p.faculty_id === fid) || [];
                  const preferCount = prefs.filter((p: any) => p.preference_type === 'PREFER').length;
                  const avoidCount = prefs.filter((p: any) => p.preference_type === 'AVOID').length;

                  return (
                    <tr key={fid} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{f.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.department}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fid}</td>
                      <td className="px-4 py-2.5">
                        <HourSelect
                          value={f.theoryHours ?? f.theory_hours ?? 0}
                          options={[0, 1, 2, 4]}
                          onChange={(v) => update(fid, { theoryHours: v })}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <HourSelect
                          value={f.labHours ?? f.lab_hours ?? 0}
                          options={[0, 2, 4]}
                          onChange={(v) => update(fid, { labHours: v })}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <HourSelect
                          value={f.inchargeHours ?? f.incharge_hours ?? 0}
                          options={[0, 2]}
                          onChange={(v) => update(fid, { inchargeHours: v })}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <HourSelect
                          value={maxH}
                          options={[12, 14, 16, 18, 20]}
                          onChange={(v) => update(fid, { maxHours: v })}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Badge variant={over ? "destructive" : "secondary"} className="font-mono">
                          {used} / {maxH}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {prefs.length > 0 ? (
                          <div className="flex gap-1.5 text-xs">
                            {preferCount > 0 && <span className="text-emerald-600 font-medium">{preferCount} Prefer</span>}
                            {avoidCount > 0 && <span className="text-destructive font-medium">{avoidCount} Avoid</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Step 3 — actions */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step 3</p>
          <h2 className="text-lg font-semibold text-foreground">Approval &amp; Generation</h2>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
              <Switch id="approve" checked={approved} onCheckedChange={setApproved} />
              <Label htmlFor="approve" className="cursor-pointer text-sm font-medium">
                Approve Workload
              </Label>
            </div>
            <Button size="lg" disabled={!approved || generating} onClick={() => generate(false)}>
              {generating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Generate Workload
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={!approved || generating}
              onClick={() => generate(true)}
            >
              {generating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CalendarCog className="mr-2 size-4" />
              )}
              Generate All Timetables
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleExport}
              className="bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 border-green-500/20"
            >
              <FileSpreadsheet className="mr-2 size-4" />
              Export to Excel
            </Button>
            {!approved ? (
              <span className="text-sm text-muted-foreground">
                Enable approval to unlock generation.
              </span>
            ) : null}
          </div>

          {generating ? (
            <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Building allocation matrix…
              </p>
              <Progress value={progress} className="mt-3" />
            </div>
          ) : null}

          {results ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
                <CheckCircle2 className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Computed Workload Preview</p>
              </div>
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="bg-background text-left">
                    {["Faculty", "Theory", "Lab", "Incharge", "Total Computed"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((f) => (
                    <tr key={f.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground">{f.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.theoryHours} hrs</td>
                      {hasLabs && <td className="px-4 py-2.5 text-muted-foreground">{f.labHours} hrs</td>}
                      <td className="px-4 py-2.5 text-muted-foreground">{f.inchargeHours} hrs</td>
                      <td className="px-4 py-2.5">
                        <Badge className="font-mono">
                          {total(f)} / {f.maxHours}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </PortalShell>
  );
}

function HourSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={String(o)}>
            {o} hr
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
