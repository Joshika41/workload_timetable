import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  Users,
  BookOpen,
  Layers,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/setup")({
  component: AdminSetup,
});

function DropzoneCard({
  title,
  icon: Icon,
  description,
  endpoint,
  templateType,
  departmentId,
  programType,
  semesterType,
}: {
  title: string;
  icon: any;
  description: string;
  endpoint: string;
  templateType: string;
  departmentId: number | null;
  programType: string;
  semesterType: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setUploadSuccess(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!programType || !semesterType) {
      toast.error(
        "Please select both Program Type and Semester Type before uploading."
      );
      return;
    }
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("program_type", programType);
    formData.append("semester_type", semesterType);
    if (departmentId) {
      formData.append("department_id", departmentId.toString());
    }

    try {
      const res = await api.post(endpoint, formData);
      toast.success(res.data.message || `Successfully uploaded ${title}`);
      setFile(null);
      setUploadSuccess(true);
    } catch (err: any) {
      toast.error(err.message || `Failed to upload ${title}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const link = document.createElement("a");
      link.href = `/templates/${templateType}_template.xlsx`;
      link.setAttribute("download", `${templateType}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success("Template downloaded!");
    } catch {
      toast.error("Failed to download template.");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
      <div className="p-6 pb-4 flex items-center justify-between border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
            <Icon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="gap-1.5 rounded-lg text-xs border-primary/30 text-primary hover:bg-primary/5 hover:text-primary shadow-sm"
        >
          <Download className="size-3.5" /> Template
        </Button>
      </div>
      <div className="p-6">
        <div
          {...getRootProps()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-300 ${
            isDragActive
              ? "border-primary bg-primary/5 scale-[1.02]"
              : uploadSuccess
                ? "border-emerald-400 bg-emerald-50/50"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input {...getInputProps()} />
          {uploadSuccess ? (
            <div className="text-center animate-in zoom-in duration-300">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">
                Upload Complete!
              </p>
              <p className="mt-1 text-xs text-emerald-600/70">
                Drop a new file to replace
              </p>
            </div>
          ) : file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB — Ready to upload
              </p>
            </div>
          ) : (
            <div className="text-center">
              <UploadCloud
                className={`mx-auto mb-3 size-8 transition-colors ${isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`}
              />
              <p className="text-sm font-medium text-foreground">
                Click or drag file here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                .xlsx or .xls up to 10MB
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Processing...
            </span>
          ) : (
            "Upload & Sync"
          )}
        </button>
      </div>
    </div>
  );
}

function AdminSetup() {
  const {
    activeDepartmentId,
    activeDepartmentName,
    programType,
    setProgramType,
    semesterType,
    setSemesterType,
  } = useWorkspace();

  if (!activeDepartmentId) {
    return (
      <PortalShell
        role="admin"
        title="Setup & Ingestion"
        subtitle="Initialize your workspace and import ERP metadata"
        nav={adminNav}
      >
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border bg-muted/20 animate-in fade-in duration-500">
          <div className="size-20 rounded-full bg-amber-100 flex items-center justify-center mb-5">
            <AlertCircle className="size-10 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            No Department Selected
          </h3>
          <p className="text-sm text-muted-foreground max-w-md text-center mb-4">
            Please go to the Department Manager and select a department workspace
            before uploading data.
          </p>
          <Button
            onClick={() =>
              (window.location.href = "/admin")
            }
            className="gap-2"
          >
            <Building2 className="size-4" /> Go to Department Manager
          </Button>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      role="admin"
      title="Setup & Ingestion"
      subtitle={`Workspace: ${activeDepartmentName || "Department"}`}
      nav={adminNav}
    >
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Workspace Session Bar */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {activeDepartmentName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Active workspace session
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Program Type
              </span>
              <ToggleGroup
                type="single"
                value={programType}
                onValueChange={(v) => v && setProgramType(v)}
                className="justify-start bg-muted p-1 rounded-xl"
              >
                <ToggleGroupItem
                  value="UG"
                  className="rounded-lg px-4 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm transition-all"
                >
                  Undergraduate (UG)
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="PG"
                  className="rounded-lg px-4 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm transition-all"
                >
                  Postgraduate (PG)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Semester Type
              </span>
              <ToggleGroup
                type="single"
                value={semesterType}
                onValueChange={(v) => v && setSemesterType(v)}
                className="justify-start bg-muted p-1 rounded-xl"
              >
                <ToggleGroupItem
                  value="Odd"
                  className="rounded-lg px-4 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm transition-all"
                >
                  Odd Semester
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Even"
                  className="rounded-lg px-4 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm transition-all"
                >
                  Even Semester
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        {/* 3 Dropzone Cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DropzoneCard
            title="Faculty Roster"
            description="Import faculty details and dispatch secure credentials."
            icon={Users}
            endpoint="/api/admin/upload-faculty"
            templateType="faculty"
            departmentId={activeDepartmentId}
            programType={programType}
            semesterType={semesterType}
          />
          <DropzoneCard
            title="Syllabus Curriculum"
            description="Import static subjects, L-T-P limits, and categories."
            icon={BookOpen}
            endpoint="/api/admin/upload-syllabus"
            templateType="syllabus"
            departmentId={activeDepartmentId}
            programType={programType}
            semesterType={semesterType}
          />
          <DropzoneCard
            title="Student Cohorts"
            description="Define active classes and sections for this term."
            icon={Layers}
            endpoint="/api/admin/upload-cohorts"
            templateType="cohorts"
            departmentId={activeDepartmentId}
            programType={programType}
            semesterType={semesterType}
          />
        </div>
      </div>
      <CurriculumManager />
    </PortalShell>
  );
}


// Curriculum Manager Component

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

function CurriculumManager() {
  const { programType, semesterType, activeDepartmentId } = useWorkspace();
  const [syllabus, setSyllabus] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  
  const [editingSyl, setEditingSyl] = useState<any>(null);
  const [editingCoh, setEditingCoh] = useState<any>(null);

  const fetchCurriculum = async () => {
    if (!activeDepartmentId || !programType || !semesterType) return;
    try {
      const sylRes = await api.get('/api/admin/syllabus', { params: { department_id: activeDepartmentId, program_type: programType, semester_type: semesterType }});
      setSyllabus(sylRes.data || []);
      
      const cohRes = await api.get('/api/admin/cohorts', { params: { department_id: activeDepartmentId, program_type: programType, semester_type: semesterType }});
      setCohorts(cohRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCurriculum();
  }, [activeDepartmentId, programType, semesterType]);

  const saveSyllabus = async () => {
    try {
      await api.put(`/api/admin/syllabus/${editingSyl.subject_code}`, editingSyl);
      toast.success("Syllabus updated");
      setEditingSyl(null);
      fetchCurriculum();
    } catch (e) {
      toast.error("Failed to update syllabus");
    }
  };

  const saveCohort = async () => {
    try {
      await api.put(`/api/admin/cohorts/${editingCoh.id}`, editingCoh);
      toast.success("Cohort updated");
      setEditingCoh(null);
      fetchCurriculum();
    } catch (e) {
      toast.error("Failed to update cohort");
    }
  };

  if (!activeDepartmentId) return null;

  return (
    <div className="mt-12 space-y-8">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">Curriculum Data Manager</h2>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Syllabus Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold">Syllabus</div>
          <div className="p-0 max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syllabus.map(s => (
                  <TableRow key={s.subject_code}>
                    <TableCell className="font-mono text-xs">{s.subject_code}</TableCell>
                    <TableCell>{s.course_title}</TableCell>
                    <TableCell>
                      <Dialog open={!!editingSyl && editingSyl.subject_code === s.subject_code} onOpenChange={(open) => !open && setEditingSyl(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setEditingSyl(s)}><Pencil className="w-4 h-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Edit Syllabus</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Course Title</Label>
                              <Input value={editingSyl?.course_title || ''} onChange={e => setEditingSyl({...editingSyl, course_title: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><Label>Theory Hrs</Label><Input type="number" value={editingSyl?.theory_hours_l || 0} onChange={e => setEditingSyl({...editingSyl, theory_hours_l: parseInt(e.target.value)})} /></div>
                              <div className="space-y-2"><Label>Lab Hrs</Label><Input type="number" value={editingSyl?.practical_hours_p || 0} onChange={e => setEditingSyl({...editingSyl, practical_hours_p: parseInt(e.target.value)})} /></div>
                              <div className="space-y-2"><Label>Credits</Label><Input type="number" value={editingSyl?.credits_c || 0} onChange={e => setEditingSyl({...editingSyl, credits_c: parseInt(e.target.value)})} /></div>
                              <div className="space-y-2"><Label>Type</Label><Input value={editingSyl?.course_type || ''} onChange={e => setEditingSyl({...editingSyl, course_type: e.target.value})} /></div>
                            </div>
                            <Button onClick={saveSyllabus} className="w-full">Save Changes</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Cohorts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold">Cohorts</div>
          <div className="p-0 max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.academic_year}</TableCell>
                    <TableCell>{c.class_name}</TableCell>
                    <TableCell>{c.section}</TableCell>
                    <TableCell>
                      <Dialog open={!!editingCoh && editingCoh.id === c.id} onOpenChange={(open) => !open && setEditingCoh(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setEditingCoh(c)}><Pencil className="w-4 h-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Edit Cohort</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><Label>Academic Year</Label><Input type="number" value={editingCoh?.academic_year || 1} onChange={e => setEditingCoh({...editingCoh, academic_year: parseInt(e.target.value)})} /></div>
                              <div className="space-y-2"><Label>Section</Label><Input value={editingCoh?.section || ''} onChange={e => setEditingCoh({...editingCoh, section: e.target.value})} /></div>
                            </div>
                            <div className="space-y-2"><Label>Class Name</Label><Input value={editingCoh?.class_name || ''} onChange={e => setEditingCoh({...editingCoh, class_name: e.target.value})} /></div>
                            <Button onClick={saveCohort} className="w-full">Save Changes</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
